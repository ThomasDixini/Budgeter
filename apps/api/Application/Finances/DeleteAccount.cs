using Orbit.Api.Domain;

namespace Orbit.Api.Application.Finances;

/// <summary>
/// Deletes an account nothing was recorded on; deleting one already gone succeeds, so retries are
/// harmless. An account with transactions or card payments is kept, since removing it would change the
/// totals of months already closed.
/// </summary>
public sealed class DeleteAccount(
    IAccountRepository accounts, IMoneyTransactionRepository transactions, ICardPaymentRepository payments)
{
    /// <summary>
    /// Validates the id, checks the account is unused and removes it if it exists.
    /// </summary>
    /// <example><code>await deleteAccount.ExecuteAsync("old-card", ct);</code></example>
    public async Task ExecuteAsync(string accountId, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(accountId, "account id");
        await RequireUnusedAsync(id, cancellationToken);
        await accounts.DeleteAsync(id, cancellationToken);
    }

    private async Task RequireUnusedAsync(string accountId, CancellationToken cancellationToken)
    {
        var hasTransactions = await transactions.AnyOnAccountAsync(accountId, cancellationToken);
        var hasPayments = await payments.AnyForAccountAsync(accountId, cancellationToken);
        if (!hasTransactions && !hasPayments) return;
        throw new ConflictException(
            $"Expected account \"{accountId}\" to have no transactions or card payments before deleting it, found some");
    }
}
