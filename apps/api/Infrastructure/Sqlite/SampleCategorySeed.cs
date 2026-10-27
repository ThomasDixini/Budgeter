using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Categories referenced by the sample routines the web app still keeps in memory
/// (apps/web/src/app/core/routines/sample-routines.ts). Seeding them keeps those blocks linked
/// until routines are persisted too.
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
    /// <example><code>await SampleCategorySeed.ApplyAsync(connection, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        foreach (var (id, name, color) in Categories)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT OR IGNORE INTO categories (id, name, color) VALUES ($id, $name, $color)",
                cancellationToken,
                ("$id", id), ("$name", name), ("$color", color));
        }
    }
}
