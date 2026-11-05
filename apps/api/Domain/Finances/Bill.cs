namespace Budgeter.Api.Domain.Finances;

/// <summary>
/// Money still to be paid (payable) or received (receivable) by a due date. Settling it records when and
/// through which account the money moved; the transaction that settlement creates carries the bill's id.
/// </summary>
public sealed class Bill
{
    public const int MaxDescriptionLength = 80;

    public string Id { get; }
    public BillKind Kind { get; }
    public string Description { get; }
    public string CategoryId { get; }

    /// <summary>What is due, in cents; always above zero whichever way the money moves.</summary>
    public long AmountCents { get; }

    public DateOnly DueDate { get; }
    public BillSettlement? Settlement { get; }
    public BillSeries? Series { get; }

    private Bill(
        string id, BillKind kind, string description, string categoryId, long amountCents,
        DateOnly dueDate, BillSettlement? settlement, BillSeries? series)
    {
        Id = id;
        Kind = kind;
        Description = description;
        CategoryId = categoryId;
        AmountCents = amountCents;
        DueDate = dueDate;
        Settlement = settlement;
        Series = series;
    }

    /// <summary>
    /// Builds a valid open bill: trimmed description, valid ids and an amount above zero within the limit.
    /// </summary>
    /// <example><code>Bill.Create("b1", BillKind.Payable, "Rent", "housing", 150000, new DateOnly(2026, 11, 5)).IsSettled; // false</code></example>
    public static Bill Create(
        string id, BillKind kind, string description, string categoryId, long amountCents,
        DateOnly dueDate, BillSeries? series = null)
    {
        return new Bill(
            EntityId.Require(id, "bill id"),
            RequireKind(kind),
            RequiredText.Require(description, MaxDescriptionLength, "bill description"),
            EntityId.Require(categoryId, "bill category id"),
            RequireAmount(amountCents),
            dueDate,
            settlement: null,
            series);
    }

    /// <summary>
    /// Rebuilds a stored bill as it was saved, without today's rules.
    /// </summary>
    /// <example><code>Bill.Restore("b1", BillKind.Payable, "Rent", "housing", 150000, due, null, null);</code></example>
    internal static Bill Restore(
        string id, BillKind kind, string description, string categoryId, long amountCents,
        DateOnly dueDate, BillSettlement? settlement, BillSeries? series) =>
        new(id, kind, description, categoryId, amountCents, dueDate, settlement, series);

    public bool IsSettled => Settlement is not null;

    /// <summary>The amount as a transaction records it: negative when paid out, positive when received.</summary>
    public long SignedAmountCents => Kind == BillKind.Payable ? -AmountCents : AmountCents;

    /// <summary>
    /// The bill settled on the day through the account; settling it again the same way changes nothing.
    /// </summary>
    /// <example><code>bill.Settle(new DateOnly(2026, 11, 5), "checking-account").IsSettled; // true</code></example>
    public Bill Settle(DateOnly date, string accountId)
    {
        var settlement = new BillSettlement(date, EntityId.Require(accountId, "settlement account id"));
        if (Settlement is null) return With(settlement);
        if (Settlement == settlement) return this;
        throw new DomainRuleException(
            $"Expected bill {ReceivedValue.Quote(Id)} to be open before settling it, found it settled on {Settlement.Date:yyyy-MM-dd}");
    }

    /// <summary>
    /// The bill open again; reopening one that is open changes nothing.
    /// </summary>
    /// <example><code>settledBill.Reopen().IsSettled; // false</code></example>
    public Bill Reopen() => Settlement is null ? this : With(null);

    private Bill With(BillSettlement? settlement) =>
        new(Id, Kind, Description, CategoryId, AmountCents, DueDate, settlement, Series);

    private static BillKind RequireKind(BillKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the bill kind to be Payable or Receivable, received {(int)kind}");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the bill amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
