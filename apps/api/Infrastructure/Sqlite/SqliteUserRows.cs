using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Moves one user's rows between the main database and an attached one, matching columns by name so a
/// file from an older or newer shape still fits. Used by backups, which hold a single account's data.
/// </summary>
internal static class SqliteUserRows
{
    /// <summary>
    /// Copies the rows of every user table the attached database has into the main one, storing them
    /// under <paramref name="toUser"/>. With <paramref name="fromUser"/> only that owner's rows are read;
    /// without it every row is (a file from before accounts, which has no owner column).
    /// </summary>
    /// <example><code>await SqliteUserRows.CopyAllAsync(connection, "backup", null, "ana-id", ct);</code></example>
    public static async Task CopyAllAsync(
        SqliteConnection connection, string schema, string? fromUser, string toUser, CancellationToken cancellationToken)
    {
        foreach (var table in SqliteSchema.UserTables)
        {
            if (!await ExistsAsync(connection, schema, table, cancellationToken)) continue;
            await CopyAsync(connection, schema, table, fromUser, toUser, cancellationToken);
        }
    }

    /// <summary>
    /// Deletes every row the user owns in the main database, children before parents so foreign keys hold.
    /// </summary>
    /// <example><code>await SqliteUserRows.DeleteAllAsync(connection, "ana-id", ct);</code></example>
    public static async Task DeleteAllAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        foreach (var table in SqliteSchema.UserTables.Reverse())
        {
            await SqliteCommands.ExecuteAsync(
                connection, $"DELETE FROM main.\"{table}\" WHERE user_id = $user", cancellationToken, ("$user", userId));
        }
    }

    /// <summary>
    /// Tells whether the attached database mixes the rows of several owners, which a backup never does.
    /// </summary>
    /// <example><code>if (await SqliteUserRows.HasSeveralOwnersAsync(connection, "backup", ct)) { ... }</code></example>
    public static async Task<bool> HasSeveralOwnersAsync(
        SqliteConnection connection, string schema, CancellationToken cancellationToken)
    {
        foreach (var table in SqliteSchema.UserTables)
        {
            if (!await HasOwnerColumnAsync(connection, schema, table, cancellationToken)) continue;
            var owners = await SqliteCommands.QueryAsync(
                connection,
                $"SELECT COUNT(DISTINCT user_id) FROM \"{schema}\".\"{table}\"",
                reader => reader.GetInt64(0),
                cancellationToken);
            if (owners[0] > 1) return true;
        }
        return false;
    }

    /// <summary>Tells whether the attached database has the table.</summary>
    /// <example><code>await SqliteUserRows.ExistsAsync(connection, "backup", "goals", ct);</code></example>
    public static async Task<bool> ExistsAsync(
        SqliteConnection connection, string schema, string table, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            $"SELECT COUNT(*) FROM \"{schema}\".sqlite_master WHERE type = 'table' AND name = $table",
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$table", table));
        return counts[0] > 0;
    }

    private static async Task<bool> HasOwnerColumnAsync(
        SqliteConnection connection, string schema, string table, CancellationToken cancellationToken)
    {
        if (!await ExistsAsync(connection, schema, table, cancellationToken)) return false;
        var counts = await SqliteCommands.QueryAsync(
            connection,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}', '{schema}') WHERE name = 'user_id'",
            reader => reader.GetInt64(0),
            cancellationToken);
        return counts[0] > 0;
    }

    private static async Task CopyAsync(
        SqliteConnection connection, string schema, string table, string? fromUser, string toUser,
        CancellationToken cancellationToken)
    {
        var columns = await SharedColumnsAsync(connection, schema, table, cancellationToken);
        var list = string.Join(", ", columns.Select(column => $"\"{column}\""));
        var filter = fromUser is null ? string.Empty : " WHERE user_id = $from";
        await SqliteCommands.ExecuteAsync(
            connection,
            $"INSERT INTO main.\"{table}\" (user_id, {list}) SELECT $to, {list} FROM \"{schema}\".\"{table}\"{filter}",
            cancellationToken,
            fromUser is null ? [("$to", toUser)] : [("$to", toUser), ("$from", fromUser)]);
    }

    private static Task<IReadOnlyList<string>> SharedColumnsAsync(
        SqliteConnection connection, string schema, string table, CancellationToken cancellationToken) =>
        SqliteCommands.QueryAsync(
            connection,
            $"""
            SELECT n.name FROM pragma_table_info('{table}', 'main') n
            JOIN pragma_table_info('{table}', '{schema}') o ON o.name = n.name
            WHERE n.name <> 'user_id'
            """,
            reader => reader.GetString(0),
            cancellationToken);
}
