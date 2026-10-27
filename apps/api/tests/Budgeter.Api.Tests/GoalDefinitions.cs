using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Tests;

/// <summary>Valid goal definitions to start each test from.</summary>
internal static class GoalDefinitions
{
    public static GoalDefinition WeeklyStudy(string id = "g1", string categoryId = "study") =>
        new(id, categoryId, "Study C# 5x a week", GoalType.Frequency, GoalPeriod.Weekly, 5, null, null);

    public static GoalDefinition CourseObjective(string id = "g2", string categoryId = "study") =>
        new(id, categoryId, "Finish the C# course", GoalType.Objective, GoalPeriod.Custom, 12, "modules",
            new DateOnly(2026, 12, 15));
}
