using System.Globalization;
using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Money transactions stored in the <c>transactions</c> table, dated as <c>YYYY-MM-DD</c> text so date
/// order and text order agree.
/// </summary>
public sealed class SqliteMoneyTransactionRepository(SqliteConnectionFactory connections) : IMoneyTransactionRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<MoneyTransaction>> ListInMonthAsync(
        TransactionMonth month, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // rowid follows creation; the upsert in SaveAsync keeps it, so an edit does not move the row.
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT id, date, description, category_id, account_id, amount_cents FROM transactions
            WHERE date >= $from AND date < $until ORDER BY date DESC, rowid DESC
            """,
            ToTransaction,
            cancellationToken,
            ("$from", ToText(month.FirstDay)), ("$until", ToText(month.NextFirstDay)));
    }

    public async Task SaveAsync(MoneyTransaction transaction, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO transactions (id, date, description, category_id, account_id, amount_cents)
            VALUES ($id, $date, $description, $categoryId, $accountId, $amountCents)
            ON CONFLICT (id) DO UPDATE SET
                date = excluded.date, description = excluded.description, category_id = excluded.category_id,
                account_id = excluded.account_id, amount_cents = excluded.amount_cents
            """,
            cancellationToken,
            ("$id", transaction.Id), ("$date", ToText(transaction.Date)), ("$description", transaction.Description),
            ("$categoryId", transaction.CategoryId), ("$accountId", transaction.AccountId),
            ("$amountCents", transaction.AmountCents));
    }

    public async Task DeleteAsync(string transactionId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM transactions WHERE id = $id", cancellationToken, ("$id", transactionId));
    }

    public async Task<long> SumAsync(string accountId, DateOnly from, DateOnly until, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var sums = await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT COALESCE(SUM(amount_cents), 0) FROM transactions
            WHERE account_id = $accountId AND date >= $from AND date < $until
            """,
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$accountId", accountId), ("$from", ToText(from)), ("$until", ToText(until)));
        return sums[0];
    }

    public async Task<bool> AnyOnAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT EXISTS (SELECT 1 FROM transactions WHERE account_id = $accountId)",
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$accountId", accountId));
        return found[0];
    }

    public async Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT EXISTS (SELECT 1 FROM transactions WHERE category_id = $categoryId)",
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$categoryId", categoryId));
        return found[0];
    }

    private static MoneyTransaction ToTransaction(SqliteDataReader reader)
    {
        return MoneyTransaction.Restore(
            reader.GetString(0),
            DateOnly.ParseExact(reader.GetString(1), DateFormat, CultureInfo.InvariantCulture),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetInt64(5));
    }

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
