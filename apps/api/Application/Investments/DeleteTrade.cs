using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

/// <summary>
/// Deletes a trade; deleting one already gone succeeds, so retries are harmless. A purchase that later
/// sales depend on is kept.
/// </summary>
public sealed class DeleteTrade(IInvestmentRepository investments)
{
    /// <summary>
    /// Validates the id, checks the remaining trades still make sense and removes the trade.
    /// </summary>
    /// <example><code>await deleteTrade.ExecuteAsync("t1", ct);</code></example>
    public async Task ExecuteAsync(string tradeId, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(tradeId, "trade id");
        var trade = await investments.FindTradeAsync(id, cancellationToken);
        if (trade is null) return;
        await RequireRemainingHistoryAsync(trade, cancellationToken);
        await investments.DeleteTradeAsync(id, cancellationToken);
    }

    private async Task RequireRemainingHistoryAsync(InvestmentTrade trade, CancellationToken cancellationToken)
    {
        var remaining = (await investments.ListTradesAsync(cancellationToken))
            .Where(stored => stored.InvestmentId == trade.InvestmentId && stored.Id != trade.Id);
        try
        {
            Position.Replay(trade.InvestmentId, remaining);
        }
        catch (DomainRuleException exception)
        {
            throw new ConflictException(
                $"Expected trade \"{trade.Id}\" to be deleted only when later sales still have units to take, found otherwise: {exception.Message}");
        }
    }
}
