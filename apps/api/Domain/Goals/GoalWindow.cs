namespace Budgeter.Api.Domain.Goals;

/// <summary>The days, both included, whose progress counts toward a goal's current period.</summary>
public readonly record struct GoalWindow(DateOnly Start, DateOnly End)
{
    /// <summary>
    /// Window of a goal period around a day: that day, its Monday–Sunday week, its calendar month or
    /// year. A custom period has no start (goals are new) and ends on its deadline.
    /// </summary>
    /// <example><code>GoalWindow.For(GoalPeriod.Weekly, new DateOnly(2026, 10, 28), null); // 2026-10-26 .. 2026-11-01</code></example>
    public static GoalWindow For(GoalPeriod period, DateOnly day, DateOnly? deadline)
    {
        return period switch
        {
            GoalPeriod.Daily => new GoalWindow(day, day),
            GoalPeriod.Weekly => WeekAround(day),
            GoalPeriod.Monthly => MonthAround(day),
            GoalPeriod.Yearly => new GoalWindow(new DateOnly(day.Year, 1, 1), new DateOnly(day.Year, 12, 31)),
            _ => new GoalWindow(DateOnly.MinValue, deadline ?? DateOnly.MaxValue),
        };
    }

    /// <summary>
    /// Whether a day falls inside the window.
    /// </summary>
    /// <example><code>window.Contains(new DateOnly(2026, 10, 30)); // true</code></example>
    public bool Contains(DateOnly day) => day >= Start && day <= End;

    private static GoalWindow WeekAround(DateOnly day)
    {
        var daysSinceMonday = ((int)day.DayOfWeek + 6) % 7;
        var monday = day.AddDays(-daysSinceMonday);
        return new GoalWindow(monday, monday.AddDays(6));
    }

    private static GoalWindow MonthAround(DateOnly day)
    {
        var first = new DateOnly(day.Year, day.Month, 1);
        return new GoalWindow(first, first.AddMonths(1).AddDays(-1));
    }
}
