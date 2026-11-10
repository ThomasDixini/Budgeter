using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Domain.Investments;

public enum TradeKind
{
    Buy,
    Sell,
}

/// <summary>
/// Units of an investment bought or sold on a day at a price. Quantities are kept in thousandths of a
/// unit, so fractions (a Tesouro bond, a fund share) need no floating point.
/// </summary>
public sealed class InvestmentTrade
{
    public const long MaxQuantityThousandths = 1_000_000_000_000;
    public const long ThousandthsPerUnit = 1000;

    public string Id { get; }
    public string InvestmentId { get; }
    public DateOnly Date { get; }
    public TradeKind Kind { get; }

    /// <summary>Units traded, in thousandths; always above zero.</summary>
    public long QuantityThousandths { get; }

    /// <summary>Price of one unit, in cents; always above zero.</summary>
    public long UnitPriceCents { get; }

    private InvestmentTrade(
        string id, string investmentId, DateOnly date, TradeKind kind, long quantityThousandths, long unitPriceCents)
    {
        Id = id;
        InvestmentId = investmentId;
        Date = date;
        Kind = kind;
        QuantityThousandths = quantityThousandths;
        UnitPriceCents = unitPriceCents;
    }

    /// <summary>
    /// Builds a valid trade: ids, a known kind, and a quantity and price above zero within the limits.
    /// </summary>
    /// <example><code>InvestmentTrade.Create("t1", "petr4", day, TradeKind.Buy, 100_000, 3845).TotalCents; // 384500</code></example>
    public static InvestmentTrade Create(
        string id, string investmentId, DateOnly date, TradeKind kind, long quantityThousandths, long unitPriceCents)
    {
        return new InvestmentTrade(
            EntityId.Require(id, "trade id"),
            EntityId.Require(investmentId, "trade investment id"),
            date,
            RequireKind(kind),
            RequireQuantity(quantityThousandths),
            RequirePrice(unitPriceCents));
    }

    /// <summary>
    /// Rebuilds a stored trade as it was saved, without today's rules.
    /// </summary>
    /// <example><code>InvestmentTrade.Restore("t1", "petr4", day, TradeKind.Buy, 100_000, 3845);</code></example>
    internal static InvestmentTrade Restore(
        string id, string investmentId, DateOnly date, TradeKind kind, long quantityThousandths, long unitPriceCents) =>
        new(id, investmentId, date, kind, quantityThousandths, unitPriceCents);

    /// <summary>What the trade moved, in cents (units times price, rounded to the cent).</summary>
    public long TotalCents => ValueOf(QuantityThousandths, UnitPriceCents);

    /// <summary>
    /// The value in cents of a quantity (in thousandths of a unit) at a unit price.
    /// </summary>
    /// <example><code>InvestmentTrade.ValueOf(2_500, 1000); // 2500</code></example>
    public static long ValueOf(long quantityThousandths, long unitPriceCents) =>
        (long)Math.Round(quantityThousandths * (decimal)unitPriceCents / ThousandthsPerUnit, MidpointRounding.AwayFromZero);

    private static TradeKind RequireKind(TradeKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected the trade kind to be Buy or Sell, received {(int)kind}");
    }

    private static long RequireQuantity(long quantityThousandths)
    {
        if (quantityThousandths > 0 && quantityThousandths <= MaxQuantityThousandths) return quantityThousandths;
        throw new DomainRuleException(
            $"Expected the quantity to be from 1 to {MaxQuantityThousandths} thousandths of a unit, received {quantityThousandths}");
    }

    private static long RequirePrice(long unitPriceCents)
    {
        if (unitPriceCents > 0 && unitPriceCents <= MoneyTransaction.MaxAbsoluteAmountCents) return unitPriceCents;
        throw new DomainRuleException(
            $"Expected the unit price to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {unitPriceCents}");
    }
}
