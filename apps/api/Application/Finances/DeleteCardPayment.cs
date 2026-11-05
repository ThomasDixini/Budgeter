using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Finances;

/// <summary>Deletes a card payment; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteCardPayment(ICardPaymentRepository payments)
{
    /// <summary>
    /// Validates the id and removes the payment if it exists.
    /// </summary>
    /// <example><code>await deleteCardPayment.ExecuteAsync("p1", ct);</code></example>
    public Task ExecuteAsync(string paymentId, CancellationToken cancellationToken)
    {
        return payments.DeleteAsync(EntityId.Require(paymentId, "card payment id"), cancellationToken);
    }
}
