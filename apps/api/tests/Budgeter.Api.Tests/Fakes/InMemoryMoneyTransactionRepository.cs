using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Transaction storage kept in a list (in creation order), for use case tests.</summary>
internal sealed class InMemoryMoneyTransactionRepository : IMoneyTransactionRepository
{
    private readonly List<MoneyTransaction> _transactions = [];

    public Task<IReadOnlyList<MoneyTransaction>> ListInMonthAsync(
        TransactionMonth month, CancellationToken cancellationToken)
    {
        var inMonth = _transactions
            .Select((transaction, position) => (transaction, position))
            .Where(entry => entry.transaction.Date >= month.FirstDay && entry.transaction.Date < month.NextFirstDay)
            .OrderByDescending(entry => entry.transaction.Date)
            .ThenByDescending(entry => entry.position)
            .Select(entry => entry.transaction);
        return Task.FromResult<IReadOnlyList<MoneyTransaction>>(inMonth.ToList());
    }

    public Task SaveAsync(MoneyTransaction transaction, CancellationToken cancellationToken)
    {
        var index = _transactions.FindIndex(stored => stored.Id == transaction.Id);
        if (index < 0) _transactions.Add(transaction);
        else _transactions[index] = transaction;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string transactionId, CancellationToken cancellationToken)
    {
        _transactions.RemoveAll(transaction => transaction.Id == transactionId);
        return Task.CompletedTask;
    }
}
