using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Test fixture: sample categories, routines and tasks for specs that need something to list. The app
/// itself starts every account empty.
/// </summary>
internal static class SampleData
{
    /// <summary>
    /// Stores the sample categories, routines and tasks of a user (routines and tasks only while the user
    /// has none).
    /// </summary>
    /// <example><code>await SampleData.ApplyAsync(connection, userId, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        await SampleCategorySeed.ApplyAsync(connection, userId, cancellationToken);
        await SampleRoutineSeed.ApplyAsync(connection, userId, cancellationToken);
        await SampleTaskSeed.ApplyAsync(connection, userId, cancellationToken);
    }
}
