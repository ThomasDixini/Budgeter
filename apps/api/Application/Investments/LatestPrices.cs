using System.Text.Json;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>The latest traded price of a symbol, in cents, and the day it is from.</summary>
public sealed record LatestQuote(string Symbol, long Cents, DateOnly Day);

/// <summary>
/// Keeps the price of the quoted investments up to date. A price is asked for only when the one held is
/// older than the day being read (so the source is reached about once a day per symbol), and a quote from a
/// day after the one being read is ignored. When the source cannot be reached the held price stays.
/// </summary>
public sealed class LatestPrices(IInvestmentRepository investments, IQuoteSource source, ILogger<LatestPrices> logger)
{
    /// <summary>
    /// Returns the investments with their prices refreshed (and stored), in the same order.
    /// </summary>
    /// <example><code>var current = await latestPrices.RefreshAsync(all, new DateOnly(2026, 11, 3), ct);</code></example>
    public async Task<IReadOnlyList<Investment>> RefreshAsync(
        IReadOnlyList<Investment> all, DateOnly asOf, CancellationToken cancellationToken)
    {
        var refreshed = new List<Investment>(all.Count);
        foreach (var investment in all) refreshed.Add(await RefreshOneAsync(investment, asOf, cancellationToken));
        return refreshed;
    }

    private async Task<Investment> RefreshOneAsync(Investment investment, DateOnly asOf, CancellationToken cancellationToken)
    {
        var symbol = QuoteSymbol.For(investment);
        if (symbol is null || investment.Price?.On >= asOf) return investment;
        var quote = await TryFetchAsync(symbol, cancellationToken);
        if (quote is null || quote.Day > asOf || quote.Day < investment.Price?.On) return investment;
        var updated = Investment.Create(
            investment.Id, investment.Name, investment.Kind, PricePoint.Create(quote.Cents, quote.Day));
        await investments.SaveAsync(updated, cancellationToken);
        return updated;
    }

    private async Task<LatestQuote?> TryFetchAsync(string symbol, CancellationToken cancellationToken)
    {
        try
        {
            return await source.FetchLatestAsync(symbol, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or FormatException or JsonException)
        {
            logger.LogWarning(exception, "Could not fetch the latest price of {Symbol}; keeping the held one", symbol);
            return null;
        }
    }
}
