using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Tests.Fakes;

/// <summary>CDI rate storage kept in a dictionary, for use case tests.</summary>
internal sealed class InMemoryCdiRateStore : ICdiRateStore
{
    private readonly SortedDictionary<DateOnly, CdiRate> _rates = [];

    public Task<IReadOnlyList<CdiRate>> ListFromAsync(DateOnly from, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CdiRate>>(_rates.Values.Where(rate => rate.Date >= from).ToList());

    public Task<(DateOnly First, DateOnly Last)?> CoverageAsync(CancellationToken cancellationToken) =>
        Task.FromResult(_rates.Count == 0 ? default((DateOnly, DateOnly)?) : (_rates.Keys.First(), _rates.Keys.Last()));

    public Task SaveAsync(IReadOnlyList<CdiRate> rates, CancellationToken cancellationToken)
    {
        foreach (var rate in rates) _rates.TryAdd(rate.Date, rate);
        return Task.CompletedTask;
    }
}

/// <summary>
/// A CDI source answering one rate per day from a fixed list (or failing), and remembering what it was asked.
/// </summary>
internal sealed class FakeCdiRateSource(params CdiRate[] published) : ICdiRateSource
{
    public List<(DateOnly From, DateOnly To)> Asked { get; } = [];

    public bool Fails { get; set; }

    public Task<IReadOnlyList<CdiRate>> FetchAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        Asked.Add((from, to));
        if (Fails) throw new HttpRequestException("The Central Bank is unreachable");
        return Task.FromResult<IReadOnlyList<CdiRate>>(published.Where(rate => rate.Date >= from && rate.Date <= to).ToList());
    }
}
