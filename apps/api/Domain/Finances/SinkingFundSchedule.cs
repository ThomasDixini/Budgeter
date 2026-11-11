namespace Orbit.Api.Domain.Finances;

/// <summary>
/// When a sinking fund falls due and how long each saving cycle lasts. The due day is kept apart from the
/// due dates so a bill due on the 31st returns to the 31st after a shorter month instead of drifting.
/// </summary>
public sealed record SinkingFundSchedule
{
    public const int MaxIntervalMonths = 60;
    public const int FixedDateCycleMonths = 12;

    public SinkingFundScheduleKind Kind { get; }
    public int IntervalMonths { get; }
    public int? Month { get; }
    public int DueDay { get; }

    private SinkingFundSchedule(SinkingFundScheduleKind kind, int intervalMonths, int? month, int dueDay)
    {
        Kind = kind;
        IntervalMonths = intervalMonths;
        Month = month;
        DueDay = dueDay;
    }

    /// <summary>
    /// A schedule that falls due every <paramref name="intervalMonths"/> months on the due day.
    /// </summary>
    /// <example><code>SinkingFundSchedule.EveryMonths(2, 15).IntervalMonths; // 2</code></example>
    public static SinkingFundSchedule EveryMonths(int intervalMonths, int dueDay)
    {
        if (intervalMonths is < 1 or > MaxIntervalMonths)
        {
            throw new DomainRuleException(
                $"Expected the interval to be from 1 to {MaxIntervalMonths} months, received {intervalMonths}");
        }
        return new SinkingFundSchedule(SinkingFundScheduleKind.EveryMonths, intervalMonths, null, RequireDay(dueDay));
    }

    /// <summary>
    /// A schedule that falls due once a year on the given month and day.
    /// </summary>
    /// <example><code>SinkingFundSchedule.FixedDate(1, 15).Month; // 1</code></example>
    public static SinkingFundSchedule FixedDate(int month, int dueDay)
    {
        if (month is < 1 or > 12)
        {
            throw new DomainRuleException($"Expected the month to be from 1 to 12, received {month}");
        }
        return new SinkingFundSchedule(SinkingFundScheduleKind.FixedDate, FixedDateCycleMonths, month, RequireDay(dueDay));
    }

    /// <summary>
    /// The due date in the month, with the due day cut to the month's last day when it is shorter.
    /// </summary>
    /// <example><code>schedule.DueIn(2026, 2); // 28 Feb 2026 for a schedule due on the 31st</code></example>
    public DateOnly DueIn(int year, int month) =>
        new(year, month, Math.Min(DueDay, DateTime.DaysInMonth(year, month)));

    /// <summary>
    /// For a fixed-date schedule, the first occurrence on or after the day.
    /// </summary>
    /// <example><code>SinkingFundSchedule.FixedDate(1, 15).FirstDueOnOrAfter(new DateOnly(2026, 3, 1)); // 15 Jan 2027</code></example>
    public DateOnly FirstDueOnOrAfter(DateOnly day)
    {
        if (Kind != SinkingFundScheduleKind.FixedDate)
        {
            throw new InvalidOperationException(
                $"Expected a {SinkingFundScheduleKind.FixedDate} schedule to find the first due date, found {Kind}");
        }
        var thisYear = DueIn(day.Year, Month!.Value);
        return thisYear >= day ? thisYear : DueIn(day.Year + 1, Month.Value);
    }

    /// <summary>
    /// The due date one cycle after the given one.
    /// </summary>
    /// <example><code>schedule.Following(new DateOnly(2026, 1, 31)); // 31 Mar 2026 for a 2-month schedule</code></example>
    public DateOnly Following(DateOnly due) => Shifted(due, IntervalMonths);

    /// <summary>
    /// The due date one cycle before the given one.
    /// </summary>
    /// <example><code>schedule.Preceding(new DateOnly(2026, 3, 31)); // 31 Jan 2026 for a 2-month schedule</code></example>
    public DateOnly Preceding(DateOnly due) => Shifted(due, -IntervalMonths);

    private DateOnly Shifted(DateOnly due, int months)
    {
        var target = due.AddMonths(months);
        return DueIn(target.Year, target.Month);
    }

    private static int RequireDay(int dueDay)
    {
        if (dueDay is >= 1 and <= 31) return dueDay;
        throw new DomainRuleException($"Expected the due day to be from 1 to 31, received {dueDay}");
    }
}
