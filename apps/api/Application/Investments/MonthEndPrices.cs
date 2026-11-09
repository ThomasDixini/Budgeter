using System.Globalization;
using System.Text.Json;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>Port to the stored month-end closing prices, kept so each month is fetched from the outside only once.</summary>
public interface IMonthEndPriceStore
{
    /// <summary>Every stored price.</summary>
    Task<IReadOnlyList<MonthEndPrice>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The latest month (<c>YYYY-MM</c>) stored for the symbol; null when there is none.</summary>
    Task<string?> LastMonthAsync(string symbol, CancellationToken cancellationToken);

    /// <summary>Stores the prices; one for a symbol and month already stored is ignored.</summary>
    Task SaveAsync(IReadOnlyList<MonthEndPrice> prices, CancellationToken cancellationToken);
}

/// <summary>Port to wherever market quotes are published.</summary>
public interface IQuoteSource
{
    /// <summary>The closing price of each month from <paramref name="from"/> to <paramref name="to"/>; empty for an unknown symbol.</summary>
    Task<IReadOnlyList<MonthEndPrice>> FetchMonthEndsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken cancellationToken);

    /// <summary>The latest traded price of the symbol; null for an unknown symbol.</summary>
    Task<LatestQuote?> FetchLatestAsync(string symbol, CancellationToken cancellationToken);
}

/// <summary>
/// The month-end prices of the quoted investments held. Only months already over are kept (the current one
/// is still moving), and only the months not stored yet are asked for. When the source cannot be reached
/// the prices already stored are used.
/// </summary>
public sealed class MonthEndPrices(IMonthEndPriceStore store, IQuoteSource source, ILogger<MonthEndPrices> logger)
{
    /// <summary>
    /// Brings the stored prices up to the last finished month, then returns all of them.
    /// </summary>
    /// <example><code>var prices = await monthEndPrices.LoadAsync(investments, trades, new DateOnly(2026, 11, 3), ct);</code></example>
    public async Task<IReadOnlyList<MonthEndPrice>> LoadAsync(
        IReadOnlyList<Investment> investments, IReadOnlyList<InvestmentTrade> trades, DateOnly asOf,
        CancellationToken cancellationToken)
    {
        var lastFinished = StartOfMonth(asOf).AddMonths(-1);
        foreach (var (symbol, firstTrade) in QuotedHoldings(investments, trades))
        {
            await RefreshAsync(symbol, StartOfMonth(firstTrade), lastFinished, cancellationToken);
        }
        return await store.ListAsync(cancellationToken);
    }

    private static IEnumerable<(string Symbol, DateOnly FirstTrade)> QuotedHoldings(
        IReadOnlyList<Investment> investments, IReadOnlyList<InvestmentTrade> trades)
    {
        return investments
            .Select(investment => (Symbol: QuoteSymbol.For(investment), investment.Id))
            .Where(held => held.Symbol is not null)
            .GroupBy(held => held.Symbol!, held => held.Id)
            .Select(group => (Symbol: group.Key, Trades: trades.Where(trade => group.Contains(trade.InvestmentId)).ToList()))
            .Where(held => held.Trades.Count > 0)
            .Select(held => (held.Symbol, held.Trades.Min(trade => trade.Date)));
    }

    private async Task RefreshAsync(
        string symbol, DateOnly firstTradeMonth, DateOnly lastFinished, CancellationToken cancellationToken)
    {
        var stored = await store.LastMonthAsync(symbol, cancellationToken);
        var from = stored is null ? firstTradeMonth : MonthAfter(stored);
        if (from > lastFinished) return;
        await TryFetchAsync(symbol, from, lastFinished, cancellationToken);
    }

    private async Task TryFetchAsync(string symbol, DateOnly from, DateOnly lastFinished, CancellationToken cancellationToken)
    {
        try
        {
            var to = lastFinished.AddMonths(1).AddDays(-1);
            var fetched = await source.FetchMonthEndsAsync(symbol, from, to, cancellationToken);
            var finished = $"{lastFinished.Year:0000}-{lastFinished.Month:00}";
            await store.SaveAsync(
                fetched.Where(price => string.CompareOrdinal(price.Month, finished) <= 0).ToList(), cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or FormatException or JsonException)
        {
            logger.LogWarning(exception, "Could not fetch the quotes of {Symbol} from {From}; using the stored ones", symbol, from);
        }
    }

    private static DateOnly StartOfMonth(DateOnly day) => new(day.Year, day.Month, 1);

    private static DateOnly MonthAfter(string month) =>
        DateOnly.ParseExact($"{month}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture).AddMonths(1);
}
