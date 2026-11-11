using System.Globalization;
using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Sinking funds stored in the <c>sinking_funds</c> table, dated as <c>YYYY-MM-DD</c> text so date order
/// and text order agree. The schedule is kept as its kind name plus the numbers that define it.
/// </summary>
public sealed class SqliteSinkingFundRepository(SqliteConnectionFactory connections) : ISinkingFundRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string OrderedByDueDate = "ORDER BY next_due_date, description, rowid";

    private const string Columns =
        "id, description, category_id, amount_cents, schedule_kind, interval_months, fixed_month, due_day, next_due_date";

    public async Task<SinkingFund?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection, $"SELECT {Columns} FROM sinking_funds WHERE user_id = $user AND id = $id", ToFund, cancellationToken,
            ("$user", connections.UserId), ("$id", id));
        return found.SingleOrDefault();
    }

    public async Task<IReadOnlyList<SinkingFund>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection, $"SELECT {Columns} FROM sinking_funds WHERE user_id = $user {OrderedByDueDate}", ToFund,
            cancellationToken, ("$user", connections.UserId));
    }

    public async Task<IReadOnlyList<SinkingFund>> ListDueOnOrBeforeAsync(DateOnly day, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {Columns} FROM sinking_funds WHERE user_id = $user AND next_due_date <= $day {OrderedByDueDate}",
            ToFund,
            cancellationToken,
            ("$user", connections.UserId), ("$day", ToText(day)));
    }

    public async Task SaveAsync(SinkingFund fund, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO sinking_funds (user_id, id, description, category_id, amount_cents, schedule_kind,
                interval_months, fixed_month, due_day, next_due_date)
            VALUES ($user, $id, $description, $categoryId, $amountCents, $scheduleKind,
                $intervalMonths, $fixedMonth, $dueDay, $nextDueDate)
            ON CONFLICT (user_id, id) DO UPDATE SET
                description = excluded.description, category_id = excluded.category_id,
                amount_cents = excluded.amount_cents, schedule_kind = excluded.schedule_kind,
                interval_months = excluded.interval_months, fixed_month = excluded.fixed_month,
                due_day = excluded.due_day, next_due_date = excluded.next_due_date
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", fund.Id), ("$description", fund.Description),
            ("$categoryId", fund.CategoryId), ("$amountCents", fund.AmountCents),
            ("$scheduleKind", fund.Schedule.Kind.ToString()), ("$intervalMonths", fund.Schedule.IntervalMonths),
            ("$fixedMonth", fund.Schedule.Month), ("$dueDay", fund.Schedule.DueDay),
            ("$nextDueDate", ToText(fund.NextDueDate)));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "DELETE FROM sinking_funds WHERE user_id = $user AND id = $id",
            cancellationToken,
            ("$user", connections.UserId), ("$id", id));
    }

    public async Task<bool> AnyInCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT EXISTS (SELECT 1 FROM sinking_funds WHERE user_id = $user AND category_id = $categoryId)",
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$user", connections.UserId), ("$categoryId", categoryId));
        return found[0];
    }

    private static SinkingFund ToFund(SqliteDataReader reader)
    {
        var schedule = ToSchedule(
            reader.GetString(4), reader.GetInt32(5), reader.IsDBNull(6) ? null : reader.GetInt32(6), reader.GetInt32(7));
        return SinkingFund.Restore(
            reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt64(3), schedule, ToDay(reader.GetString(8)));
    }

    private static SinkingFundSchedule ToSchedule(string kind, int intervalMonths, int? month, int dueDay)
    {
        if (kind == nameof(SinkingFundScheduleKind.EveryMonths)) return SinkingFundSchedule.EveryMonths(intervalMonths, dueDay);
        if (kind == nameof(SinkingFundScheduleKind.FixedDate) && month is { } fixedMonth) return SinkingFundSchedule.FixedDate(fixedMonth, dueDay);
        throw new InvalidOperationException(
            $"Expected the schedule kind to be {nameof(SinkingFundScheduleKind.EveryMonths)} or {nameof(SinkingFundScheduleKind.FixedDate)} " +
            $"(FixedDate needs a month), received '{kind}' with month {month?.ToString(CultureInfo.InvariantCulture) ?? "none"}");
    }

    private static DateOnly ToDay(string text) => DateOnly.ParseExact(text, DateFormat, CultureInfo.InvariantCulture);

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
