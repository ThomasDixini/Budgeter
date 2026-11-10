using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Domain.Investments;

/// <summary>The price of one unit of an investment, in cents, as typed by the user on a day.</summary>
public sealed record PricePoint
{
    public long Cents { get; }
    public DateOnly On { get; }

    private PricePoint(long cents, DateOnly on)
    {
        Cents = cents;
        On = on;
    }

    /// <summary>
    /// Builds a valid price: above zero and within the amount limit.
    /// </summary>
    /// <example><code>PricePoint.Create(3845, new DateOnly(2026, 11, 3)).Cents; // 3845</code></example>
    public static PricePoint Create(long cents, DateOnly on)
    {
        if (cents > 0 && cents <= MoneyTransaction.MaxAbsoluteAmountCents) return new PricePoint(cents, on);
        throw new DomainRuleException(
            $"Expected the unit price to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {cents}");
    }

    /// <summary>
    /// Rebuilds a stored price as it was saved, without today's rules.
    /// </summary>
    /// <example><code>PricePoint.Restore(3845, new DateOnly(2026, 11, 3));</code></example>
    internal static PricePoint Restore(long cents, DateOnly on) => new(cents, on);
}
