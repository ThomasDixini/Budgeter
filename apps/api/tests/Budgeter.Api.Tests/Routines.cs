using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Tests;

/// <summary>Valid routines and save commands for tests, varied only where a test needs it.</summary>
internal static class Routines
{
    public static Routine Weekdays(string? studyCategoryId = "study") => Routine.Create(
        "weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00",
        [
            RoutineBlock.Create("work", "Work", "08:00", "12:00", null),
            RoutineBlock.Create("csharp", "C# study", "13:30", "15:00", studyCategoryId),
        ]);

    public static SaveRoutineCommand WeekdaysCommand(string? studyCategoryId = "study") => new(
        "weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00",
        [
            new SaveRoutineBlockCommand("work", "Work", "08:00", "12:00", null),
            new SaveRoutineBlockCommand("csharp", "C# study", "13:30", "15:00", studyCategoryId),
        ]);
}
