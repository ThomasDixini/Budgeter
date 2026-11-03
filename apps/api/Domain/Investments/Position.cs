namespace Budgeter.Api.Domain.Investments;

/// <summary>
/// What is held of one investment after its trades: the units and what they cost. Sales take their share
/// of the cost at the average price, so the cost left is always that of the units still held.
/// </summary>
public sealed record Position(long QuantityThousandths, long CostCents)
{
    public static readonly Position Empty = new(0, 0);

    /// <summary>
    /// Replays the trades in date order (a purchase before a sale on the same day); throws when a sale
    /// takes more units than were held at that point.
    /// </summary>
    /// <example><code>Position.Replay("petr4", [buy100, sell40]).QuantityThousandths; // 60_000</code></example>
    public static Position Replay(string investmentId, IEnumerable<InvestmentTrade> trades)
    {
        var ordered = trades.OrderBy(trade => trade.Date).ThenBy(trade => trade.Kind == TradeKind.Sell ? 1 : 0);
        return ordered.Aggregate(Empty, (position, trade) => position.Apply(investmentId, trade));
    }

    private Position Apply(string investmentId, InvestmentTrade trade)
    {
        if (trade.Kind == TradeKind.Buy) return new(QuantityThousandths + trade.QuantityThousandths, CostCents + trade.TotalCents);
        if (trade.QuantityThousandths > QuantityThousandths)
        {
            throw new DomainRuleException(
                $"Expected a sale of investment \"{investmentId}\" on {trade.Date:yyyy-MM-dd} to take at most the {QuantityThousandths} thousandths held, received {trade.QuantityThousandths}");
        }
        var left = QuantityThousandths - trade.QuantityThousandths;
        var costLeft = (long)Math.Round(CostCents * (decimal)left / QuantityThousandths, MidpointRounding.AwayFromZero);
        return new(left, costLeft);
    }
}
