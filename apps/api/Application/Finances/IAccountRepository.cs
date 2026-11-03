using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Port to the storage of bank accounts and credit cards.</summary>
public interface IAccountRepository
{
    /// <summary>All accounts in creation order.</summary>
    Task<IReadOnlyList<Account>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The account with this id, or null when there is none.</summary>
    Task<Account?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores the account, replacing a stored one with the same id without moving it in the list.</summary>
    Task SaveAsync(Account account, CancellationToken cancellationToken);

    /// <summary>Removes the account; an unknown id is ignored.</summary>
    Task DeleteAsync(string accountId, CancellationToken cancellationToken);
}
