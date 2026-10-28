using System.Globalization;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// The goal progress log in the <c>goal_progress</c> table. Entries are only ever added or removed,
/// never edited, and the entry id is the primary key, which is what makes repeated writes harmless.
/// </summary>
public sealed class SqliteGoalProgressLedger(SqliteConnectionFactory connections) : IGoalProgressLedger
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task RecordAsync(GoalProgressEvent entry, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT OR IGNORE INTO goal_progress (event_id, goal_id, date, amount, source, source_ref)
            VALUES ($eventId, $goalId, $date, $amount, $source, $sourceRef)
            """,
            cancellationToken,
            ("$eventId", entry.EventId), ("$goalId", entry.GoalId), ("$date", ToText(entry.Date)),
            ("$amount", entry.Amount), ("$source", entry.Source.ToString().ToLowerInvariant()),
            ("$sourceRef", entry.SourceRef));
    }

    public async Task TakeBackAsync(GoalProgressEvent entry, GoalWindow window, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        // One statement: the sum is read and the entry written together, so it cannot interleave with another.
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT OR IGNORE INTO goal_progress (event_id, goal_id, date, amount, source, source_ref)
            SELECT $eventId, $goalId, $date, $amount, 'manual', ''
            WHERE (SELECT COALESCE(SUM(amount), 0) FROM goal_progress
                   WHERE goal_id = $goalId AND source = 'manual' AND date >= $start AND date <= $end) + $amount >= 0
            """,
            cancellationToken,
            ("$eventId", entry.EventId), ("$goalId", entry.GoalId), ("$date", ToText(entry.Date)),
            ("$amount", entry.Amount), ("$start", ToText(window.Start)), ("$end", ToText(window.End)));
    }

    public async Task RemoveBySourceAsync(
        GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            "DELETE FROM goal_progress WHERE source = $source AND source_ref = $sourceRef AND date = $date",
            cancellationToken,
            ("$source", source.ToString().ToLowerInvariant()), ("$sourceRef", sourceRef), ("$date", ToText(day)));
    }

    public async Task RemoveAutomaticAsync(string goalId, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            "DELETE FROM goal_progress WHERE goal_id = $goalId AND source <> 'manual'",
            cancellationToken,
            ("$goalId", goalId));
    }

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
