using System.Text.Json;
using Budgeter.Api.Domain.Investments;

namespace Budgeter.Api.Application.Investments;

/// <summary>The portfolio with the trades and proventos behind it, for the page to list.</summary>
public sealed record PortfolioSnapshot(
    Portfolio Portfolio, IReadOnlyList<InvestmentTrade> Trades, IReadOnlyList<InvestmentIncome> Incomes,
    IReadOnlyList<MonthlyPoint> History);

/// <summary>
/// Reads the portfolio as of a day. The daily CDI rates it compares against are stored once fetched; when
/// the Central Bank cannot be reached, the rates already stored are used and the result says how far they go.
/// The month-end history is valued at closing prices, fetched once per finished month, and the quoted
/// investments take their latest price from the quote source.
/// </summary>
public sealed class GetPortfolio(
    IInvestmentRepository investments, ICdiRateStore rateStore, ICdiRateSource rateSource,
    MonthEndPrices monthEndPrices, LatestPrices latestPrices, ILogger<GetPortfolio> logger)
{
    private const int ClosedDaysSlack = 4;

    /// <summary>
    /// Brings the CDI rates up to date, then builds the portfolio.
    /// </summary>
    /// <example><code>var snapshot = await getPortfolio.ExecuteAsync(new DateOnly(2026, 11, 3), ct);</code></example>
    public async Task<PortfolioSnapshot> ExecuteAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var all = await latestPrices.RefreshAsync(await investments.ListAsync(cancellationToken), asOf, cancellationToken);
        var trades = await investments.ListTradesAsync(cancellationToken);
        var incomes = await investments.ListIncomesAsync(cancellationToken);
        var cdi = await CdiSinceFirstTradeAsync(trades, asOf, cancellationToken);
        var prices = await monthEndPrices.LoadAsync(all, trades, asOf, cancellationToken);
        return new PortfolioSnapshot(
            Portfolio.Build(all, trades, incomes, asOf, cdi), trades, incomes,
            PortfolioHistory.Build(all, trades, incomes, prices, cdi, asOf));
    }

    private async Task<CdiIndex> CdiSinceFirstTradeAsync(
        IReadOnlyList<InvestmentTrade> trades, DateOnly asOf, CancellationToken cancellationToken)
    {
        if (trades.Count == 0) return new CdiIndex([]);
        var first = trades.Min(trade => trade.Date);
        await FillGapsAsync(first, asOf, cancellationToken);
        return new CdiIndex(await rateStore.ListFromAsync(first, cancellationToken));
    }

    private async Task FillGapsAsync(DateOnly first, DateOnly asOf, CancellationToken cancellationToken)
    {
        var coverage = await rateStore.CoverageAsync(cancellationToken);
        var gaps = coverage is { } stored ? GapsAround(stored, first, asOf) : [(first, asOf)];
        foreach (var (from, to) in gaps) await TryFetchAsync(from, to, cancellationToken);
    }

    // The rates only exist on business days, and a long weekend or holiday can leave several days without
    // one at either end; a gap that short is not worth asking the Central Bank about on every request.
    private static List<(DateOnly From, DateOnly To)> GapsAround(
        (DateOnly First, DateOnly Last) stored, DateOnly first, DateOnly asOf)
    {
        var gaps = new List<(DateOnly, DateOnly)>();
        if (first < stored.First.AddDays(-ClosedDaysSlack)) gaps.Add((first, stored.First.AddDays(-1)));
        if (stored.Last.AddDays(ClosedDaysSlack) < asOf) gaps.Add((stored.Last.AddDays(1), asOf));
        return gaps;
    }

    private async Task TryFetchAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        try
        {
            var rates = await rateSource.FetchAsync(from, to, cancellationToken);
            await rateStore.SaveAsync(rates, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or FormatException or JsonException)
        {
            logger.LogWarning(exception, "Could not fetch the CDI rates from {From} to {To}; using the stored ones", from, to);
        }
    }
}
