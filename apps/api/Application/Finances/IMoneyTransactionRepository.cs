using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>Port to the storage of money transactions.</summary>
public interface IMoneyTransactionRepository
{
    /// <summary>
    /// The transactions dated in the month, newest day first and, within a day, the most recently
    /// created first.
    /// </summary>
    Task<IReadOnlyList<MoneyTransaction>> ListInMonthAsync(TransactionMonth month, CancellationToken cancellationToken);

    /// <summary>Stores the transaction, replacing a stored one with the same id without moving it.</summary>
    Task SaveAsync(MoneyTransaction transaction, CancellationToken cancellationToken);

    /// <summary>Removes the transaction; an unknown id is ignored.</summary>
    Task DeleteAsync(string transactionId, CancellationToken cancellationToken);
}
