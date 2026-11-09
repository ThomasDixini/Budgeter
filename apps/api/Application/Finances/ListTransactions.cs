using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>Lists the transactions of one month.</summary>
public sealed class ListTransactions(IMoneyTransactionRepository transactions)
{
    /// <summary>
    /// Validates the month (<c>YYYY-MM</c>) and returns its transactions, newest first.
    /// </summary>
    /// <example><code>var october = await listTransactions.ExecuteAsync("2026-10", ct);</code></example>
    public Task<IReadOnlyList<MoneyTransaction>> ExecuteAsync(string month, CancellationToken cancellationToken)
    {
        return transactions.ListInMonthAsync(TransactionMonth.Parse(month), cancellationToken);
    }
}
