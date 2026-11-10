using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Application.Investments;

public sealed record SaveTradeCommand(
    string Id, string InvestmentId, DateOnly Date, TradeKind Kind, long QuantityThousandths, long UnitPriceCents);

/// <summary>Records or replaces a purchase or sale; saving the same trade twice leaves the same state.</summary>
public sealed class SaveTrade(IInvestmentRepository investments)
{
    /// <summary>
    /// Checks the investment exists and that, with this trade, no sale ever takes more than was held.
    /// </summary>
    /// <example><code>await saveTrade.ExecuteAsync(new SaveTradeCommand("t1", "petr4", day, TradeKind.Buy, 100_000, 3845), ct);</code></example>
    public async Task<InvestmentTrade> ExecuteAsync(SaveTradeCommand command, CancellationToken cancellationToken)
    {
        var trade = InvestmentTrade.Create(
            command.Id, command.InvestmentId, command.Date, command.Kind, command.QuantityThousandths, command.UnitPriceCents);
        if (await investments.FindAsync(trade.InvestmentId, cancellationToken) is null)
        {
            throw ResourceNotFoundException.For("investment", trade.InvestmentId);
        }
        await RequireValidHistoryAsync(trade, cancellationToken);
        await investments.SaveTradeAsync(trade, cancellationToken);
        return trade;
    }

    private async Task RequireValidHistoryAsync(InvestmentTrade trade, CancellationToken cancellationToken)
    {
        var others = (await investments.ListTradesAsync(cancellationToken))
            .Where(stored => stored.InvestmentId == trade.InvestmentId && stored.Id != trade.Id);
        Position.Replay(trade.InvestmentId, others.Append(trade));
    }
}
