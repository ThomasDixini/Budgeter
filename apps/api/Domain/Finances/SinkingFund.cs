using System.Globalization;

namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Money set aside over the months before an irregular bill falls due. The saved amount is calculated from
/// the time elapsed in the current cycle; nothing is deposited. On the due date it becomes a payable bill.
/// </summary>
public sealed class SinkingFund
{
    public const int MaxDescriptionLength = 80;

    /// <summary>Shorter than the generic id limit so the derived bill id still fits it.</summary>
    public const int MaxIdLength = 48;

    public string Id { get; }
    public string Description { get; }
    public string CategoryId { get; }

    /// <summary>The cost of one cycle, in cents; always above zero.</summary>
    public long AmountCents { get; }

    public SinkingFundSchedule Schedule { get; }
    public DateOnly NextDueDate { get; }

    private SinkingFund(
        string id, string description, string categoryId, long amountCents,
        SinkingFundSchedule schedule, DateOnly nextDueDate)
    {
        Id = id;
        Description = description;
        CategoryId = categoryId;
        AmountCents = amountCents;
        Schedule = schedule;
        NextDueDate = nextDueDate;
    }

    /// <summary>
    /// Builds a valid sinking fund: trimmed description, valid ids and an amount above zero within the limit.
    /// </summary>
    /// <example><code>SinkingFund.Create("f1", "IPVA", "taxes", 120000, SinkingFundSchedule.FixedDate(1, 15), new DateOnly(2027, 1, 15)).MonthlyCents; // 10000</code></example>
    public static SinkingFund Create(
        string id, string description, string categoryId, long amountCents,
        SinkingFundSchedule schedule, DateOnly nextDueDate)
    {
        return new SinkingFund(
            RequireId(id),
            RequiredText.Require(description, MaxDescriptionLength, "sinking fund description"),
            EntityId.Require(categoryId, "sinking fund category id"),
            RequireAmount(amountCents),
            schedule,
            nextDueDate);
    }

    /// <summary>
    /// Rebuilds a stored sinking fund as it was saved, without today's rules.
    /// </summary>
    /// <example><code>SinkingFund.Restore("f1", "IPVA", "taxes", 120000, schedule, due);</code></example>
    internal static SinkingFund Restore(
        string id, string description, string categoryId, long amountCents,
        SinkingFundSchedule schedule, DateOnly nextDueDate) =>
        new(id, description, categoryId, amountCents, schedule, nextDueDate);

    /// <summary>The day the current saving cycle began: the due date one cycle back.</summary>
    public DateOnly CycleStart => Schedule.Preceding(NextDueDate);

    /// <summary>What to set aside each month, rounded up so the bill is covered by its due date.</summary>
    public long MonthlyCents
    {
        get
        {
            long cycleMonths = Schedule.IntervalMonths;
            return (AmountCents + cycleMonths - 1) / cycleMonths;
        }
    }

    /// <summary>
    /// The share of the cost saved by the day: whole months elapsed in the cycle, from none to all of it.
    /// </summary>
    /// <example><code>fund.SavedCents(new DateOnly(2026, 7, 15)); // 60000 for 120000 over 12 months, 6 elapsed</code></example>
    public long SavedCents(DateOnly today)
    {
        var cycleMonths = Schedule.IntervalMonths;
        var elapsed = Math.Clamp(ElapsedMonths(CycleStart, today), 0, cycleMonths);
        return (long)Math.Round((decimal)AmountCents * elapsed / cycleMonths, MidpointRounding.AwayFromZero);
    }

    /// <summary>The id of the bill this cycle creates; the same cycle always yields the same id.</summary>
    public string CurrentBillId => string.Create(CultureInfo.InvariantCulture, $"sf-{Id}-{NextDueDate:yyyyMMdd}");

    /// <summary>
    /// The fund moved on to its next cycle.
    /// </summary>
    /// <example><code>fund.AdvancedOneCycle().NextDueDate; // 15 Jan 2028 for a yearly fund due 15 Jan 2027</code></example>
    public SinkingFund AdvancedOneCycle() =>
        new(Id, Description, CategoryId, AmountCents, Schedule, Schedule.Following(NextDueDate));

    /// <summary>
    /// The payable bill for the current due date.
    /// </summary>
    /// <example><code>fund.CurrentBill().DueDate == fund.NextDueDate; // true</code></example>
    public Bill CurrentBill() =>
        Bill.Create(CurrentBillId, BillKind.Payable, Description, CategoryId, AmountCents, NextDueDate);

    private static int ElapsedMonths(DateOnly start, DateOnly today)
    {
        var months = (today.Year - start.Year) * 12 + today.Month - start.Month;
        return today.Day < start.Day ? months - 1 : months;
    }

    private static string RequireId(string id)
    {
        if (id.Length > MaxIdLength)
        {
            throw new DomainRuleException(
                $"Expected the sinking fund id to be 1-{MaxIdLength} letters, digits or dashes, received {ReceivedValue.Quote(id)}");
        }
        return EntityId.Require(id, "sinking fund id");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the sinking fund amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
