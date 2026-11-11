using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Sample categories, referenced by the blocks of <see cref="SampleRoutineSeed"/>.
/// </summary>
internal static class SampleCategorySeed
{
    private static readonly (string Id, string Name, string Color)[] Categories =
    [
        ("study", "Study", "#7DD3FC"),
        ("networking", "Networking", "#F0ABFC"),
        ("reading", "Reading", "#FBBF24"),
        ("exercise", "Exercise", "#FCA5A5"),
    ];

    /// <summary>
    /// Inserts the sample categories that are missing; existing rows are left untouched.
    /// </summary>
    /// <example><code>await SampleCategorySeed.ApplyAsync(connection, userId, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, string userId, CancellationToken cancellationToken)
    {
        foreach (var (id, name, color) in Categories)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT OR IGNORE INTO categories (user_id, id, name, color) VALUES ($user, $id, $name, $color)",
                cancellationToken,
                ("$user", userId), ("$id", id), ("$name", name), ("$color", color));
        }
    }
}
