using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// The sample categories, routines and tasks, given to a database once. Seeding on every start brought
/// back what the user had deleted (a sample category reappeared after each restart).
/// </summary>
internal static class SampleData
{
    /// <summary>
    /// Seeds an empty database and records that it did; a database seeded before, or already holding
    /// the user's own data, is only marked, so nothing ever comes back after being deleted.
    /// </summary>
    /// <example><code>await SampleData.ApplyOnceAsync(connection, ct);</code></example>
    public static async Task ApplyOnceAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (await IsMarkedAsync(connection, cancellationToken)) return;
        if (!await HoldsDataAsync(connection, cancellationToken))
        {
            await SampleCategorySeed.ApplyAsync(connection, cancellationToken);
            await SampleRoutineSeed.ApplyAsync(connection, cancellationToken);
            await SampleTaskSeed.ApplyAsync(connection, cancellationToken);
        }
        await SqliteCommands.ExecuteAsync(connection, "INSERT INTO sample_seed (id) VALUES (1)", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> IsMarkedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM sample_seed", reader => reader.GetInt64(0), cancellationToken);
        return counts[0] > 0;
    }

    private static async Task<bool> HoldsDataAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            "SELECT (SELECT COUNT(*) FROM categories) + (SELECT COUNT(*) FROM routines) + (SELECT COUNT(*) FROM tasks)",
            reader => reader.GetInt64(0),
            cancellationToken);
        return counts[0] > 0;
    }
}
