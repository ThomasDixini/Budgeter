namespace Budgeter.Api.Domain.Investments;

/// <summary>
/// How the portfolio did against leaving the same money in the CDI. Both gains are over the same cash
/// flows: each purchase would have been put in the CDI that day, and each sale or provento taken out of it.
/// </summary>
public sealed record PortfolioPerformance(long InvestedCents, long GainCents, long CdiGainCents, DateOnly? CdiThrough)
{
    private const int PercentDecimals = 2;

    /// <summary>The portfolio's gain as a percentage of what was invested.</summary>
    public decimal GainPercent => PercentOfInvested(GainCents);

    /// <summary>What the same flows would have gained in the CDI, as a percentage of what was invested.</summary>
    public decimal CdiPercent => PercentOfInvested(CdiGainCents);

    /// <summary>
    /// Works out the performance as of a day, or none when nothing was ever bought. The portfolio gain is
    /// what it is worth now plus what came out of it (sales and proventos) minus what went in.
    /// </summary>
    /// <example><code>PortfolioPerformance.From(trades, incomes, currentValueCents: 120000, cdi, asOf)?.GainPercent;</code></example>
    public static PortfolioPerformance? From(
        IReadOnlyCollection<InvestmentTrade> trades,
        IReadOnlyCollection<InvestmentIncome> incomes,
        long currentValueCents,
        CdiIndex cdi,
        DateOnly asOf)
    {
        var buys = trades.Where(trade => trade.Kind == TradeKind.Buy).ToList();
        var invested = buys.Sum(trade => trade.TotalCents);
        if (invested == 0) return null;
        var outflows = OutflowsOf(trades, incomes);
        var gain = currentValueCents + outflows.Sum(flow => flow.Cents) - invested;
        var cdiGain = CdiGain(buys.Select(trade => (trade.Date, trade.TotalCents)), outflows, cdi, asOf);
        return new PortfolioPerformance(invested, gain, cdiGain, cdi.Through);
    }

    private static List<(DateOnly Date, long Cents)> OutflowsOf(
        IEnumerable<InvestmentTrade> trades, IEnumerable<InvestmentIncome> incomes)
    {
        var sales = trades.Where(trade => trade.Kind == TradeKind.Sell).Select(trade => (trade.Date, trade.TotalCents));
        var proventos = incomes.Select(income => (income.Date, income.AmountCents));
        return [.. sales, .. proventos];
    }

    private static long CdiGain(
        IEnumerable<(DateOnly Date, long Cents)> inflows,
        IEnumerable<(DateOnly Date, long Cents)> outflows,
        CdiIndex cdi,
        DateOnly asOf)
    {
        decimal Growth((DateOnly Date, long Cents) flow) => flow.Cents * (cdi.FactorBetween(flow.Date, asOf) - 1);
        return (long)Math.Round(inflows.Sum(Growth) - outflows.Sum(Growth), MidpointRounding.AwayFromZero);
    }

    private decimal PercentOfInvested(long cents) =>
        Math.Round(cents * 100m / InvestedCents, PercentDecimals, MidpointRounding.AwayFromZero);
}
