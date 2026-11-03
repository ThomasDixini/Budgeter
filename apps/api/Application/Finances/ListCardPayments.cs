using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Lists the card invoice payments of one month.</summary>
public sealed class ListCardPayments(ICardPaymentRepository payments)
{
    /// <summary>
    /// Validates the month (<c>YYYY-MM</c>) and returns its payments, newest first.
    /// </summary>
    /// <example><code>var november = await listCardPayments.ExecuteAsync("2026-11", ct);</code></example>
    public Task<IReadOnlyList<CardPayment>> ExecuteAsync(string month, CancellationToken cancellationToken)
    {
        return payments.ListInMonthAsync(TransactionMonth.Parse(month), cancellationToken);
    }
}
