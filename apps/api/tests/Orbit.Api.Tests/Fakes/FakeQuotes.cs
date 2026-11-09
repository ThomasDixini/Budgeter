using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Month-end price storage kept in a dictionary, for use case tests.</summary>
internal sealed class InMemoryMonthEndPriceStore : IMonthEndPriceStore
{
    private readonly SortedDictionary<(string Symbol, string Month), MonthEndPrice> _prices = [];

    public Task<IReadOnlyList<MonthEndPrice>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<MonthEndPrice>>(_prices.Values.ToList());

    public Task<string?> LastMonthAsync(string symbol, CancellationToken cancellationToken) =>
        Task.FromResult(_prices.Keys.Where(key => key.Symbol == symbol).Select(key => key.Month).Max());

    public Task SaveAsync(IReadOnlyList<MonthEndPrice> prices, CancellationToken cancellationToken)
    {
        foreach (var price in prices) _prices.TryAdd((price.Symbol, price.Month), price);
        return Task.CompletedTask;
    }
}

/// <summary>A quote source answering one close per month from a fixed list (or failing), and remembering what it was asked.</summary>
internal sealed class FakeQuoteSource(params MonthEndPrice[] published) : IQuoteSource
{
    public List<(string Symbol, DateOnly From, DateOnly To)> Asked { get; } = [];

    public bool Fails { get; set; }

    public LatestQuote? Latest { get; set; }

    public int LatestAsked { get; private set; }

    public Task<LatestQuote?> FetchLatestAsync(string symbol, CancellationToken cancellationToken)
    {
        LatestAsked++;
        if (Fails) throw new HttpRequestException("The quote service is unreachable");
        return Task.FromResult(Latest is { } quote && quote.Symbol == symbol ? quote : null);
    }

    public Task<IReadOnlyList<MonthEndPrice>> FetchMonthEndsAsync(
        string symbol, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        Asked.Add((symbol, from, to));
        if (Fails) throw new HttpRequestException("The quote service is unreachable");
        return Task.FromResult<IReadOnlyList<MonthEndPrice>>(published.Where(price => price.Symbol == symbol).ToList());
    }
}
