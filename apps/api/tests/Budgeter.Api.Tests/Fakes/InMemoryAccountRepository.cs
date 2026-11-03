using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Account storage kept in a list (in creation order), for use case tests.</summary>
internal sealed class InMemoryAccountRepository(params Account[] accounts) : IAccountRepository
{
    private readonly List<Account> _accounts = [.. accounts];

    public Task<IReadOnlyList<Account>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<Account>>(_accounts.ToList());
    }

    public Task<Account?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_accounts.Find(account => account.Id == id));
    }

    public Task SaveAsync(Account account, CancellationToken cancellationToken)
    {
        var index = _accounts.FindIndex(stored => stored.Id == account.Id);
        if (index < 0) _accounts.Add(account);
        else _accounts[index] = account;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string accountId, CancellationToken cancellationToken)
    {
        _accounts.RemoveAll(account => account.Id == accountId);
        return Task.CompletedTask;
    }
}
