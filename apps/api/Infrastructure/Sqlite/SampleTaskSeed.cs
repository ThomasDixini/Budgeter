using Budgeter.Api.Domain.Tasks;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// The tasks the web app used to keep in memory, now recurring so the Today list has something on
/// any day. Their categories come from <see cref="SampleCategorySeed"/>.
/// </summary>
internal static class SampleTaskSeed
{
    private static readonly TaskItem[] Tasks =
    [
        TaskItem.Create("t1", "Reply to pending emails", null, TaskRepeat.Daily, [], null),
        TaskItem.Create("t2", "Review class notes", "study", TaskRepeat.Weekly, [0, 1, 2, 3, 4], null),
        TaskItem.Create("t3", "Do the LINQ exercises", "study", TaskRepeat.Weekly, [1, 3], null),
        TaskItem.Create("t4", "Message 2 contacts", "networking", TaskRepeat.Weekly, [0, 2, 4], null),
        TaskItem.Create("t5", "Read 20 pages", "reading", TaskRepeat.Daily, [], null),
    ];

    /// <summary>
    /// Inserts the sample tasks only while no task exists, so tasks the user removed never come back.
    /// </summary>
    /// <example><code>await SampleTaskSeed.ApplyAsync(connection, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM tasks", reader => reader.GetInt64(0), cancellationToken);
        if (counts[0] > 0) return;

        foreach (var task in Tasks) await SqliteTaskRepository.WriteAsync(connection, task, cancellationToken);
    }
}
