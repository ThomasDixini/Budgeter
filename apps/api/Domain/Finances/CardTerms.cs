namespace Orbit.Api.Domain.Finances;

/// <summary>
/// How a credit card bills: its limit, the day each invoice closes and the day it is due. A purchase made
/// on the closing day already goes to the next invoice, and a day past the end of a short month falls on
/// that month's last day (closing on the 31st closes on February 28).
/// </summary>
public sealed record CardTerms
{
    public const int LastDay = 31;

    public long LimitCents { get; }
    public int ClosingDay { get; }
    public int DueDay { get; }

    private CardTerms(long limitCents, int closingDay, int dueDay)
    {
        LimitCents = limitCents;
        ClosingDay = closingDay;
        DueDay = dueDay;
    }

    /// <summary>
    /// Builds valid terms: a limit above zero within the amount limit, and days of the month from 1 to 31.
    /// </summary>
    /// <example><code>CardTerms.Create(500000, closingDay: 3, dueDay: 10).DueDay; // 10</code></example>
    public static CardTerms Create(long limitCents, int closingDay, int dueDay)
    {
        return new CardTerms(
            RequireLimit(limitCents), RequireDay(closingDay, "closing day"), RequireDay(dueDay, "due day"));
    }

    /// <summary>
    /// Rebuilds stored terms as they were saved, without today's rules.
    /// </summary>
    /// <example><code>CardTerms.Restore(500000, 3, 10);</code></example>
    internal static CardTerms Restore(long limitCents, int closingDay, int dueDay) => new(limitCents, closingDay, dueDay);

    /// <summary>
    /// The invoice a purchase made on the day goes to.
    /// </summary>
    /// <example><code>CardTerms.Create(500000, 3, 10).CycleContaining(new(2026, 11, 2)).ClosesOn; // 2026-11-03</code></example>
    public InvoiceCycle CycleContaining(DateOnly day)
    {
        var closingThisMonth = ClosingDateIn(day.Year, day.Month);
        return CycleClosingOn(day < closingThisMonth ? closingThisMonth : ClosingDateAfter(closingThisMonth));
    }

    /// <summary>
    /// The invoice that closed when the given one started.
    /// </summary>
    /// <example><code>terms.CycleBefore(terms.CycleContaining(today)); // the last closed invoice</code></example>
    public InvoiceCycle CycleBefore(InvoiceCycle cycle) => CycleClosingOn(cycle.StartsOn);

    private InvoiceCycle CycleClosingOn(DateOnly closesOn)
    {
        var previousMonth = FirstOfMonth(closesOn).AddMonths(-1);
        return new InvoiceCycle(
            ClosingDateIn(previousMonth.Year, previousMonth.Month), closesOn, DueDateFor(closesOn));
    }

    // Due later in the closing month when the due day comes after the closing day, else the month after.
    private DateOnly DueDateFor(DateOnly closesOn)
    {
        var dueMonth = DueDay > ClosingDay ? FirstOfMonth(closesOn) : FirstOfMonth(closesOn).AddMonths(1);
        return DayIn(dueMonth.Year, dueMonth.Month, DueDay);
    }

    private DateOnly ClosingDateAfter(DateOnly closing)
    {
        var nextMonth = FirstOfMonth(closing).AddMonths(1);
        return ClosingDateIn(nextMonth.Year, nextMonth.Month);
    }

    private DateOnly ClosingDateIn(int year, int month) => DayIn(year, month, ClosingDay);

    private static DateOnly DayIn(int year, int month, int day) =>
        new(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)));

    private static DateOnly FirstOfMonth(DateOnly day) => new(day.Year, day.Month, 1);

    private static long RequireLimit(long limitCents)
    {
        if (limitCents > 0 && limitCents <= MoneyTransaction.MaxAbsoluteAmountCents) return limitCents;
        throw new DomainRuleException(
            $"Expected the card limit to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {limitCents}");
    }

    private static int RequireDay(int day, string description)
    {
        if (day is >= 1 and <= LastDay) return day;
        throw new DomainRuleException($"Expected the card {description} to be a day of the month from 1 to {LastDay}, received {day}");
    }
}
