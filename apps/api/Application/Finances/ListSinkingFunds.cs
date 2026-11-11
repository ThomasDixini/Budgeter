using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>A sinking fund with what is saved of it on the day and when its current cycle began.</summary>
public sealed record SinkingFundSummary(SinkingFund Fund, long SavedCents, DateOnly CycleStart);

public sealed record SinkingFundsOverview(IReadOnlyList<SinkingFundSummary> Funds, long TotalMonthlyCents);

/// <summary>Every sinking fund, with the total to set aside each month.</summary>
public sealed class ListSinkingFunds(ISinkingFundRepository funds)
{
    /// <summary>
    /// Reads the funds as of a day.
    /// </summary>
    /// <example><code>var overview = await listSinkingFunds.ExecuteAsync(new DateOnly(2026, 11, 11), ct);</code></example>
    public async Task<SinkingFundsOverview> ExecuteAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var stored = await funds.ListAsync(cancellationToken);
        var summaries = stored
            .Select(fund => new SinkingFundSummary(fund, fund.SavedCents(today), fund.CycleStart))
            .ToList();
        return new SinkingFundsOverview(summaries, stored.Sum(fund => fund.MonthlyCents));
    }
}
