using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Lists every bank account and credit card in creation order.</summary>
public sealed class ListAccounts(IAccountRepository accounts)
{
    /// <summary>
    /// Returns all accounts, for the transaction form and the account filter.
    /// </summary>
    /// <example><code>var all = await listAccounts.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<Account>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return accounts.ListAsync(cancellationToken);
    }
}
