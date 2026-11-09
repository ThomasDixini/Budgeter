namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Money that came in (positive amount) or went out (negative amount) of an account on a day. Named
/// MoneyTransaction so it never reads as a database transaction next to the SQLite code.
/// </summary>
public sealed class MoneyTransaction
{
    public const int MaxDescriptionLength = 80;

    /// <summary>R$ 10 million: far above any personal transaction, low enough that sums never overflow.</summary>
    public const long MaxAbsoluteAmountCents = 1_000_000_000;

    public string Id { get; }
    public DateOnly Date { get; }
    public string Description { get; }
    public string CategoryId { get; }
    public string AccountId { get; }

    /// <summary>Signed amount in cents: positive is income, negative is an expense; never zero.</summary>
    public long AmountCents { get; }

    private MoneyTransaction(
        string id, DateOnly date, string description, string categoryId, string accountId, long amountCents)
    {
        Id = id;
        Date = date;
        Description = description;
        CategoryId = categoryId;
        AccountId = accountId;
        AmountCents = amountCents;
    }

    /// <summary>
    /// Builds a valid transaction: trimmed description, valid ids and a non-zero amount within the limit.
    /// </summary>
    /// <example><code>MoneyTransaction.Create("tx1", new DateOnly(2026, 10, 31), "Groceries", "food", "credit-card", -28640).IsIncome; // false</code></example>
    public static MoneyTransaction Create(
        string id, DateOnly date, string description, string categoryId, string accountId, long amountCents)
    {
        return new MoneyTransaction(
            EntityId.Require(id, "transaction id"),
            date,
            RequiredText.Require(description, MaxDescriptionLength, "transaction description"),
            EntityId.Require(categoryId, "transaction category id"),
            EntityId.Require(accountId, "transaction account id"),
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Rebuilds a stored transaction as it was saved, without today's rules.
    /// </summary>
    /// <example><code>MoneyTransaction.Restore("tx1", new DateOnly(2026, 10, 5), "Salary", "salary", "checking-account", 950000);</code></example>
    internal static MoneyTransaction Restore(
        string id, DateOnly date, string description, string categoryId, string accountId, long amountCents) =>
        new(id, date, description, categoryId, accountId, amountCents);

    public bool IsIncome => AmountCents > 0;

    private static long RequireAmount(long amountCents)
    {
        if (amountCents != 0 && Math.Abs(amountCents) <= MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the transaction amount to be a non-zero number of cents from -{MaxAbsoluteAmountCents} to {MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
