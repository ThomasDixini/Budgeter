using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Domain.Investments;

/// <summary>What sort of provento was received.</summary>
public enum IncomeKind
{
    Dividend,
    InterestOnEquity,
    Yield,
}

/// <summary>Money an investment paid out (a dividend, interest on equity or a fund yield) on a day.</summary>
public sealed class InvestmentIncome
{
    public string Id { get; }
    public string InvestmentId { get; }
    public DateOnly Date { get; }
    public IncomeKind Kind { get; }

    /// <summary>What was received, in cents; always above zero.</summary>
    public long AmountCents { get; }

    private InvestmentIncome(string id, string investmentId, DateOnly date, IncomeKind kind, long amountCents)
    {
        Id = id;
        InvestmentId = investmentId;
        Date = date;
        Kind = kind;
        AmountCents = amountCents;
    }

    /// <summary>
    /// Builds a valid income: ids, a known kind and an amount above zero within the limit.
    /// </summary>
    /// <example><code>InvestmentIncome.Create("i1", "petr4", day, IncomeKind.Dividend, 12000).AmountCents; // 12000</code></example>
    public static InvestmentIncome Create(string id, string investmentId, DateOnly date, IncomeKind kind, long amountCents)
    {
        return new InvestmentIncome(
            EntityId.Require(id, "income id"),
            EntityId.Require(investmentId, "income investment id"),
            date,
            RequireKind(kind),
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Rebuilds a stored income as it was saved, without today's rules.
    /// </summary>
    /// <example><code>InvestmentIncome.Restore("i1", "petr4", day, IncomeKind.Dividend, 12000);</code></example>
    internal static InvestmentIncome Restore(string id, string investmentId, DateOnly date, IncomeKind kind, long amountCents) =>
        new(id, investmentId, date, kind, amountCents);

    private static IncomeKind RequireKind(IncomeKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the income kind to be a known one, received {(int)kind}");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the income amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
