namespace Budgeter.Api.Domain.Finances;

/// <summary>
/// One billing period of a credit card: purchases dated from <see cref="StartsOn"/> up to the day before
/// <see cref="ClosesOn"/> make up the invoice, paid by <see cref="DueOn"/>.
/// </summary>
public sealed record InvoiceCycle(DateOnly StartsOn, DateOnly ClosesOn, DateOnly DueOn)
{
    /// <summary>
    /// Whether a purchase made on the day belongs to this invoice.
    /// </summary>
    /// <example><code>new InvoiceCycle(new(2026, 10, 3), new(2026, 11, 3), new(2026, 11, 10)).Contains(new(2026, 11, 3)); // false</code></example>
    public bool Contains(DateOnly day) => day >= StartsOn && day < ClosesOn;
}
