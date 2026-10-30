namespace Budgeter.Api.Tests;

/// <summary>Fixed days for tests of period-based behavior.</summary>
internal static class TestDays
{
    /// <summary>A Wednesday, in the week of Monday 2026-10-26.</summary>
    public static readonly DateOnly Today = new(2026, 10, 28);

    /// <summary>The Monday of <see cref="Today"/>'s week, which is the first day of its weekly period.</summary>
    public static readonly DateOnly MondayOfThisWeek = new(2026, 10, 26);
}
