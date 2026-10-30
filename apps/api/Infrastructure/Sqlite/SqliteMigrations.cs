using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Changes to tables that already existed before the current schema, applied once each and
/// recorded in SQLite's <c>user_version</c> so a step never runs twice.
/// </summary>
internal static class SqliteMigrations
{
    /// <summary>
    /// Runs every step the database has not seen, each in its own transaction.
    /// </summary>
    /// <example><code>await SqliteMigrations.ApplyAsync(connection, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var versions = await SqliteCommands.QueryAsync(
            connection, "PRAGMA user_version", reader => reader.GetInt32(0), cancellationToken);
        if (versions[0] < 1) await GoalProgressLogAsync(connection, cancellationToken);
        if (versions[0] < 2) await TrackingFromTypeAsync(connection, cancellationToken);
    }

    /// <summary>
    /// Version 2: what feeds a goal follows from its type (frequency goals count blocks, objectives are
    /// marked achieved), so stored goals get the tracking their type implies. Progress entries are kept.
    /// </summary>
    private static async Task TrackingFromTypeAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        var versions = await SqliteCommands.QueryAsync(
            connection, "PRAGMA user_version", reader => reader.GetInt32(0), cancellationToken);
        if (versions[0] >= 2) return;
        await SqliteCommands.ExecuteAsync(
            connection,
            "UPDATE goals SET tracking = CASE type WHEN 'frequency' THEN 'blocks' ELSE 'manual' END",
            cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "PRAGMA user_version = 2", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Version 1: goals gain "tracking", and the single progress number each goal used to hold becomes
    /// one manual entry in the progress log (dated the day of the migration; later entries are
    /// dated by the client).
    /// </summary>
    private static async Task GoalProgressLogAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        // Takes the write lock up front and re-reads the version, so two starts at once cannot both run the step.
        await using var transaction = connection.BeginTransaction(deferred: false);
        var versions = await SqliteCommands.QueryAsync(
            connection, "PRAGMA user_version", reader => reader.GetInt32(0), cancellationToken);
        if (versions[0] >= 1) return;
        if (!await HasColumnAsync(connection, "goals", "tracking", cancellationToken))
        {
            await SqliteCommands.ExecuteAsync(
                connection, "ALTER TABLE goals ADD COLUMN tracking TEXT NOT NULL DEFAULT 'manual'", cancellationToken);
        }
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT OR IGNORE INTO goal_progress (event_id, goal_id, date, amount, source, source_ref)
            SELECT 'legacy:' || id, id, date('now', 'localtime'), done, 'manual', '' FROM goals WHERE done > 0
            """,
            cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "PRAGMA user_version = 1", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> HasColumnAsync(
        SqliteConnection connection, string table, string column, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            "SELECT COUNT(*) FROM pragma_table_info($table) WHERE name = $column",
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$table", table), ("$column", column));
        return counts[0] > 0;
    }
}
