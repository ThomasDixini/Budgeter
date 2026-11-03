using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Finances;

/// <summary>Deletes a transaction; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteTransaction(IMoneyTransactionRepository transactions)
{
    /// <summary>
    /// Validates the id and removes the transaction if it exists.
    /// </summary>
    /// <example><code>await deleteTransaction.ExecuteAsync("tx1", ct);</code></example>
    public Task ExecuteAsync(string transactionId, CancellationToken cancellationToken)
    {
        return transactions.DeleteAsync(EntityId.Require(transactionId, "transaction id"), cancellationToken);
    }
}
