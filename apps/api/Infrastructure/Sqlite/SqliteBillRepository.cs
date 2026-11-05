using System.Globalization;
using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Bills stored in the <c>bills</c> table, dated as <c>YYYY-MM-DD</c> text so date order and text order
/// agree. The settlement account has no foreign key: the transaction the settlement created already keeps
/// that account from being deleted.
/// </summary>
public sealed class SqliteBillRepository(SqliteConnectionFactory connections) : IBillRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    private const string Columns =
        "id, kind, description, category_id, amount_cents, due_date, settled_on, settled_account_id, " +
        "series_id, recurrence, series_number, series_count";

    public async Task<Bill?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection, $"SELECT {Columns} FROM bills WHERE id = $id", ToBill, cancellationToken, ("$id", id));
        return found.SingleOrDefault();
    }

    public async Task<IReadOnlyList<Bill>> ListOpenDueBeforeAsync(DateOnly until, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {Columns} FROM bills WHERE settled_on IS NULL AND due_date < $until ORDER BY due_date, rowid",
            ToBill,
            cancellationToken,
            ("$until", ToText(until)));
    }

    public async Task<IReadOnlyList<Bill>> ListSettledSinceAsync(DateOnly since, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {Columns} FROM bills WHERE settled_on >= $since ORDER BY settled_on DESC, rowid DESC",
            ToBill,
            cancellationToken,
            ("$since", ToText(since)));
    }

    public async Task SaveAsync(Bill bill, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO bills (id, kind, description, category_id, amount_cents, due_date, settled_on,
                settled_account_id, series_id, recurrence, series_number, series_count)
            VALUES ($id, $kind, $description, $categoryId, $amountCents, $dueDate, $settledOn,
                $settledAccountId, $seriesId, $recurrence, $seriesNumber, $seriesCount)
            ON CONFLICT (id) DO UPDATE SET
                kind = excluded.kind, description = excluded.description, category_id = excluded.category_id,
                amount_cents = excluded.amount_cents, due_date = excluded.due_date,
                settled_on = excluded.settled_on, settled_account_id = excluded.settled_account_id,
                series_id = excluded.series_id, recurrence = excluded.recurrence,
                series_number = excluded.series_number, series_count = excluded.series_count
            """,
            cancellationToken,
            ("$id", bill.Id), ("$kind", bill.Kind.ToString()), ("$description", bill.Description),
            ("$categoryId", bill.CategoryId), ("$amountCents", bill.AmountCents), ("$dueDate", ToText(bill.DueDate)),
            ("$settledOn", bill.Settlement is { } settlement ? ToText(settlement.Date) : null),
            ("$settledAccountId", bill.Settlement?.AccountId),
            ("$seriesId", bill.Series?.SeriesId), ("$recurrence", bill.Series?.Recurrence.ToString()),
            ("$seriesNumber", bill.Series?.Number), ("$seriesCount", bill.Series?.Count));
    }

    public async Task DeleteAsync(string billId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM bills WHERE id = $id", cancellationToken, ("$id", billId));
    }

    public async Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT EXISTS (SELECT 1 FROM bills WHERE category_id = $categoryId)",
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$categoryId", categoryId));
        return found[0];
    }

    private static Bill ToBill(SqliteDataReader reader)
    {
        return Bill.Restore(
            reader.GetString(0),
            Enum.Parse<BillKind>(reader.GetString(1)),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetInt64(4),
            ToDay(reader.GetString(5)),
            reader.IsDBNull(6) ? null : new BillSettlement(ToDay(reader.GetString(6)), reader.GetString(7)),
            reader.IsDBNull(8)
                ? null
                : new BillSeries(
                    reader.GetString(8), Enum.Parse<BillRecurrence>(reader.GetString(9)),
                    reader.GetInt32(10), reader.GetInt32(11)));
    }

    private static DateOnly ToDay(string text) => DateOnly.ParseExact(text, DateFormat, CultureInfo.InvariantCulture);

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
