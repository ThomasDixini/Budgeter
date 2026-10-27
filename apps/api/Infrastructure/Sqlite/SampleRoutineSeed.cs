using Budgeter.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// The weekday and weekend routines the web app used to keep in memory, so a fresh database
/// opens the editor with something to adjust. Their blocks reference <see cref="SampleCategorySeed"/>.
/// </summary>
internal static class SampleRoutineSeed
{
    private static readonly Routine[] Routines =
    [
        Routine.Create("weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00",
        [
            RoutineBlock.Create("work", "Work", "08:00", "12:00", null),
            RoutineBlock.Create("lunch", "Lunch", "12:00", "13:30", null),
            RoutineBlock.Create("csharp", "C# study", "13:30", "15:00", "study"),
            RoutineBlock.Create("network", "Networking", "15:00", "17:00", "networking"),
        ]),
        Routine.Create("weekend", "Weekend", [5, 6], "09:00", "14:00",
        [
            RoutineBlock.Create("workout", "Workout", "09:00", "10:00", "exercise"),
            RoutineBlock.Create("read", "Reading", "10:00", "12:00", "reading"),
            RoutineBlock.Create("weekend-lunch", "Lunch", "12:00", "13:30", null),
        ]),
    ];

    /// <summary>
    /// Inserts the sample routines only while no routine exists, so blocks the user removed never come back.
    /// </summary>
    /// <example><code>await SampleRoutineSeed.ApplyAsync(connection, ct);</code></example>
    public static async Task ApplyAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM routines", reader => reader.GetInt64(0), cancellationToken);
        if (counts[0] > 0) return;

        await using var transaction = connection.BeginTransaction();
        foreach (var routine in Routines)
        {
            await SqliteRoutineRepository.WriteAsync(connection, routine, cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
    }
}
