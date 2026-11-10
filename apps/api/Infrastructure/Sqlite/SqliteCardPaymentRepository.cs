using System.Globalization;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Card invoice payments stored in the <c>card_payments</c> table, dated as <c>YYYY-MM-DD</c> text so date
/// order and text order agree.
/// </summary>
public sealed class SqliteCardPaymentRepository(SqliteConnectionFactory connections) : ICardPaymentRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<CardPayment>> ListInMonthAsync(TransactionMonth month, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT id, card_id, from_account_id, date, amount_cents FROM card_payments
            WHERE user_id = $user AND date >= $from AND date < $until ORDER BY date DESC, rowid DESC
            """,
            ToPayment,
            cancellationToken,
            ("$user", connections.UserId), ("$from", ToText(month.FirstDay)), ("$until", ToText(month.NextFirstDay)));
    }

    public async Task SaveAsync(CardPayment payment, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO card_payments (user_id, id, card_id, from_account_id, date, amount_cents)
            VALUES ($user, $id, $cardId, $fromAccountId, $date, $amountCents)
            ON CONFLICT (user_id, id) DO UPDATE SET
                card_id = excluded.card_id, from_account_id = excluded.from_account_id,
                date = excluded.date, amount_cents = excluded.amount_cents
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", payment.Id), ("$cardId", payment.CardId), ("$fromAccountId", payment.FromAccountId),
            ("$date", ToText(payment.Date)), ("$amountCents", payment.AmountCents));
    }

    public async Task DeleteAsync(string paymentId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "DELETE FROM card_payments WHERE user_id = $user AND id = $id",
            cancellationToken,
            ("$user", connections.UserId), ("$id", paymentId));
    }

    public Task<long> SumPaidFromAsync(string accountId, DateOnly until, CancellationToken cancellationToken) =>
        SumAsync("from_account_id", accountId, until, cancellationToken);

    public Task<long> SumPaidToAsync(string cardId, DateOnly until, CancellationToken cancellationToken) =>
        SumAsync("card_id", cardId, until, cancellationToken);

    public async Task<bool> AnyForAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT EXISTS (SELECT 1 FROM card_payments WHERE user_id = $user AND (card_id = $id OR from_account_id = $id))",
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$user", connections.UserId), ("$id", accountId));
        return found[0];
    }

    // The column comes from the two callers above, never from a request.
    private async Task<long> SumAsync(string accountColumn, string accountId, DateOnly until, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var sums = await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT COALESCE(SUM(amount_cents), 0) FROM card_payments WHERE user_id = $user AND {accountColumn} = $id AND date < $until",
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$user", connections.UserId), ("$id", accountId), ("$until", ToText(until)));
        return sums[0];
    }

    private static CardPayment ToPayment(SqliteDataReader reader)
    {
        return CardPayment.Restore(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            DateOnly.ParseExact(reader.GetString(3), DateFormat, CultureInfo.InvariantCulture),
            reader.GetInt64(4));
    }

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
