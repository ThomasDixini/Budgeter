using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

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
    /// <example><code>await SampleData.ApplyOnceAsync(connection, userId, ct);</code></example>
    public static async Task ApplyOnceAsync(SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        if (await IsMarkedAsync(connection, userId, cancellationToken)) return;
        if (!await HoldsDataAsync(connection, userId, cancellationToken))
        {
            await SampleCategorySeed.ApplyAsync(connection, userId, cancellationToken);
            await SampleRoutineSeed.ApplyAsync(connection, userId, cancellationToken);
            await SampleTaskSeed.ApplyAsync(connection, userId, cancellationToken);
        }
        await SqliteCommands.ExecuteAsync(connection, "INSERT INTO sample_seed (user_id) VALUES ($user)", cancellationToken,
            ("$user", userId));
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task<bool> IsMarkedAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM sample_seed WHERE user_id = $user", reader => reader.GetInt64(0), cancellationToken,
            ("$user", userId));
        return counts[0] > 0;
    }

    private static async Task<bool> HoldsDataAsync(
        SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            """
            SELECT (SELECT COUNT(*) FROM categories WHERE user_id = $user)
                + (SELECT COUNT(*) FROM routines WHERE user_id = $user)
                + (SELECT COUNT(*) FROM tasks WHERE user_id = $user)
            """,
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$user", userId));
        return counts[0] > 0;
    }
}
