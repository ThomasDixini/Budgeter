namespace Budgeter.Api.Domain.Investments;

/// <summary>One investment as held today: units, what they cost, what they are worth and what they paid out.</summary>
public sealed record PortfolioLine(
    Investment Investment, long QuantityThousandths, long CostCents, long? ValueCents, long IncomeCents)
{
    /// <summary>The price-based value, or the cost while no price was typed, so a missing price shows no gain or loss.</summary>
    public long EffectiveValueCents => ValueCents ?? CostCents;

    /// <summary>Value minus cost; absent when nothing is held or no price is known.</summary>
    public long? GainCents => ValueCents is null || QuantityThousandths == 0 ? null : ValueCents - CostCents;
}

/// <summary>The portfolio added up; <c>UnpricedCount</c> is how many held investments are valued at cost.</summary>
public sealed record PortfolioTotals(
    long CostCents, long ValueCents, int UnpricedCount, long IncomeCents, long IncomeLast12MonthsCents);

/// <summary>Everything the Investments page shows: the lines, their totals and how they did against the CDI.</summary>
public sealed record Portfolio(
    IReadOnlyList<PortfolioLine> Lines, PortfolioTotals Totals, PortfolioPerformance? Performance)
{
    private const int IncomeWindowMonths = 12;

    /// <summary>
    /// Puts the portfolio together as of a day. Lines are ordered by value, the largest first.
    /// </summary>
    /// <example><code>var portfolio = Portfolio.Build(investments, trades, incomes, new DateOnly(2026, 11, 3), cdi);</code></example>
    public static Portfolio Build(
        IReadOnlyList<Investment> investments,
        IReadOnlyList<InvestmentTrade> trades,
        IReadOnlyList<InvestmentIncome> incomes,
        DateOnly asOf,
        CdiIndex cdi)
    {
        var lines = investments
            .Select(investment => LineOf(investment, trades, incomes))
            .OrderByDescending(line => line.EffectiveValueCents)
            .ThenBy(line => line.Investment.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var totals = TotalsOf(lines, incomes, asOf);
        return new Portfolio(lines, totals, PortfolioPerformance.From(trades, incomes, totals.ValueCents, cdi, asOf));
    }

    private static PortfolioLine LineOf(
        Investment investment, IEnumerable<InvestmentTrade> trades, IEnumerable<InvestmentIncome> incomes)
    {
        var position = Position.Replay(investment.Id, trades.Where(trade => trade.InvestmentId == investment.Id));
        var value = ValueOf(investment, position);
        var income = incomes.Where(current => current.InvestmentId == investment.Id).Sum(current => current.AmountCents);
        return new PortfolioLine(investment, position.QuantityThousandths, position.CostCents, value, income);
    }

    private static long? ValueOf(Investment investment, Position position)
    {
        if (position.QuantityThousandths == 0) return 0;
        return investment.Price is null
            ? null
            : InvestmentTrade.ValueOf(position.QuantityThousandths, investment.Price.Cents);
    }

    private static PortfolioTotals TotalsOf(IReadOnlyList<PortfolioLine> lines, IEnumerable<InvestmentIncome> incomes, DateOnly asOf)
    {
        var since = asOf.AddMonths(-IncomeWindowMonths);
        return new PortfolioTotals(
            lines.Sum(line => line.CostCents),
            lines.Sum(line => line.EffectiveValueCents),
            lines.Count(line => line.QuantityThousandths > 0 && line.ValueCents is null),
            incomes.Sum(income => income.AmountCents),
            incomes.Where(income => income.Date > since && income.Date <= asOf).Sum(income => income.AmountCents));
    }
}
