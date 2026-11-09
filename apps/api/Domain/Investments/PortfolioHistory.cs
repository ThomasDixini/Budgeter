namespace Orbit.Api.Domain.Investments;

/// <summary>The whole portfolio at the end of a month: what it is worth, what was put in and how it did against the CDI.</summary>
public sealed record MonthlyPoint(string Month, long ValueCents, long AppliedCents, decimal ReturnPercent, decimal CdiPercent);

/// <summary>
/// The portfolio month by month since the first trade. Each month is valued at the closing prices of its
/// end; the month of <c>asOf</c> uses the latest price typed for the investment when there is one, so the
/// last point agrees with the portfolio. An investment with no price for a month is valued at what it cost.
/// </summary>
public static class PortfolioHistory
{
    private const int PercentDecimals = 2;

    /// <summary>
    /// Builds one point for every month from the first trade up to the month of <paramref name="asOf"/>.
    /// </summary>
    /// <example><code>PortfolioHistory.Build(investments, trades, incomes, prices, cdi, new DateOnly(2026, 11, 3))[0].Month; // "2026-01"</code></example>
    public static IReadOnlyList<MonthlyPoint> Build(
        IReadOnlyList<Investment> investments,
        IReadOnlyList<InvestmentTrade> trades,
        IReadOnlyList<InvestmentIncome> incomes,
        IReadOnlyList<MonthEndPrice> prices,
        CdiIndex cdi,
        DateOnly asOf)
    {
        if (trades.Count == 0) return [];
        var points = new List<MonthlyPoint>();
        var first = StartOfMonth(trades.Min(trade => trade.Date));
        for (var month = first; month <= asOf; month = month.AddMonths(1))
        {
            points.Add(PointAt(month, investments, trades, incomes, prices, cdi, asOf));
        }
        return points;
    }

    private static MonthlyPoint PointAt(
        DateOnly month, IReadOnlyList<Investment> investments, IReadOnlyList<InvestmentTrade> trades,
        IReadOnlyList<InvestmentIncome> incomes, IReadOnlyList<MonthEndPrice> prices, CdiIndex cdi, DateOnly asOf)
    {
        var end = Earliest(month.AddMonths(1).AddDays(-1), asOf);
        var key = MonthKey(month);
        var tradesUpTo = trades.Where(trade => trade.Date <= end).ToList();
        var incomesUpTo = incomes.Where(income => income.Date <= end).ToList();
        var value = investments.Sum(investment => ValueOf(investment, tradesUpTo, prices, key, key == MonthKey(asOf)));
        var applied = tradesUpTo.Sum(SignedCents);
        var received = incomesUpTo.Sum(income => income.AmountCents);
        var cdiGain = CdiGain(tradesUpTo, incomesUpTo, cdi, end);
        return new MonthlyPoint(
            key, value, applied, PercentOf(value + received - applied, applied), PercentOf(cdiGain, applied));
    }

    private static long ValueOf(
        Investment investment, IEnumerable<InvestmentTrade> trades, IReadOnlyList<MonthEndPrice> prices,
        string month, bool isCurrentMonth)
    {
        var position = Position.Replay(investment.Id, trades.Where(trade => trade.InvestmentId == investment.Id));
        var price = isCurrentMonth && investment.Price is { } typed ? typed.Cents : QuotedPrice(investment, prices, month);
        return price is null ? position.CostCents : InvestmentTrade.ValueOf(position.QuantityThousandths, price.Value);
    }

    // A month without a close of its own (a ticker that did not trade) keeps the last one before it.
    private static long? QuotedPrice(Investment investment, IReadOnlyList<MonthEndPrice> prices, string month)
    {
        var symbol = QuoteSymbol.For(investment);
        if (symbol is null) return null;
        return prices
            .Where(price => price.Symbol == symbol && string.CompareOrdinal(price.Month, month) <= 0)
            .MaxBy(price => price.Month)?.Cents;
    }

    // The same money kept in the CDI: purchases go in on their day, sales and proventos come out.
    private static long CdiGain(
        IEnumerable<InvestmentTrade> trades, IEnumerable<InvestmentIncome> incomes, CdiIndex cdi, DateOnly end)
    {
        decimal Growth(DateOnly date, long cents) => cents * (cdi.FactorBetween(date, end) - 1);
        var gain = trades.Sum(trade => Growth(trade.Date, SignedCents(trade)))
            - incomes.Sum(income => Growth(income.Date, income.AmountCents));
        return (long)Math.Round(gain, MidpointRounding.AwayFromZero);
    }

    private static long SignedCents(InvestmentTrade trade) =>
        trade.Kind == TradeKind.Buy ? trade.TotalCents : -trade.TotalCents;

    private static decimal PercentOf(long cents, long applied) =>
        applied <= 0 ? 0 : Math.Round(cents * 100m / applied, PercentDecimals, MidpointRounding.AwayFromZero);

    private static DateOnly StartOfMonth(DateOnly day) => new(day.Year, day.Month, 1);

    private static string MonthKey(DateOnly day) => $"{day.Year:0000}-{day.Month:00}";

    private static DateOnly Earliest(DateOnly first, DateOnly second) => first < second ? first : second;
}
