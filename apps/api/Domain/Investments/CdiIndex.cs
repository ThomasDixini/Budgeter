namespace Orbit.Api.Domain.Investments;

/// <summary>The CDI rate of one business day, as a percentage (0.0545 is 0.0545% for the day).</summary>
public sealed record CdiRate(DateOnly Date, decimal DailyPercent);

/// <summary>
/// How much money grew by sitting in the CDI between two days, from the daily rates known. Money put in
/// on a day starts earning on the next one.
/// </summary>
public sealed class CdiIndex
{
    private readonly IReadOnlyList<CdiRate> _rates;

    public CdiIndex(IEnumerable<CdiRate> rates)
    {
        _rates = rates.OrderBy(rate => rate.Date).ToList();
    }

    /// <summary>The last day a rate is known for; absent when there are none.</summary>
    public DateOnly? Through => _rates.Count == 0 ? null : _rates[^1].Date;

    /// <summary>
    /// The growth factor over the days after <paramref name="from"/> up to and including <paramref name="to"/>;
    /// 1 when no rate falls in between.
    /// </summary>
    /// <example><code>new CdiIndex([new(new DateOnly(2026, 11, 4), 0.05m)]).FactorBetween(new DateOnly(2026, 11, 3), new DateOnly(2026, 11, 4)); // 1.0005</code></example>
    public decimal FactorBetween(DateOnly from, DateOnly to)
    {
        var factor = 1m;
        foreach (var rate in _rates.Where(rate => rate.Date > from && rate.Date <= to))
        {
            factor *= 1 + rate.DailyPercent / 100;
        }
        return factor;
    }
}
