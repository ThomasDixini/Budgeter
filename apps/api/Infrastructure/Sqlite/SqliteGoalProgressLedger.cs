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

    public async Task RemoveAsync(string eventId, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM goal_progress WHERE event_id = $eventId", cancellationToken,
            ("$eventId", eventId));
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

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
