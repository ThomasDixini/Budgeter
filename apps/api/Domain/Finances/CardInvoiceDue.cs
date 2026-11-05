namespace Budgeter.Api.Domain.Finances;

/// <summary>
/// A card invoice still to be paid, shown next to the bills. It is derived from the card's statement, not
/// stored: paying it is a card payment, after which it no longer appears.
/// </summary>
public sealed record CardInvoiceDue(string CardId, DateOnly DueOn, long AmountCents, bool IsClosed)
{
    /// <summary>
    /// What is left to pay on the card's closed and open invoices. Payments settle the oldest debt first,
    /// so what is owed beyond the closed amount is the open invoice's (at most its own total).
    /// </summary>
    /// <example><code>CardInvoiceDue.From("credit-card", limitCents: 500000, statement).Select(due => due.DueOn);</code></example>
    public static IReadOnlyList<CardInvoiceDue> From(string cardId, long limitCents, CardStatement card)
    {
        var owed = limitCents - card.AvailableLimitCents;
        var open = Math.Clamp(owed - card.AmountDueCents, 0, card.OpenInvoice.AmountCents);
        var dues = new List<CardInvoiceDue>();
        if (card.AmountDueCents > 0) dues.Add(new(cardId, card.ClosedInvoice.Cycle.DueOn, card.AmountDueCents, IsClosed: true));
        if (open > 0) dues.Add(new(cardId, card.OpenInvoice.Cycle.DueOn, open, IsClosed: false));
        return dues;
    }
}
