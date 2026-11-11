using System.Globalization;
using Orbit.Api.Application.Goals;
using Orbit.Api.Domain.Goals;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Goals stored in the <c>goals</c> table (enums as lower-case names). A goal's progress is not stored
/// on it: it is the sum of its <c>goal_progress</c> entries inside the period around the requested day.
/// </summary>
public sealed class SqliteGoalRepository(SqliteConnectionFactory connections) : IGoalRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string SelectColumns =
        "SELECT id, category_id, title, type, period, target, unit, deadline, tracking FROM goals WHERE user_id = $user";

    // Two queries whatever the number of goals: the definitions, then the log entries of their periods.
    public async Task<IReadOnlyList<Goal>> ListAsync(DateOnly day, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var definitions = await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} ORDER BY rowid", ToDefinition, cancellationToken,
            ("$user", connections.UserId));
        var entries = await EntriesAroundAsync(lease.Connection, connections.UserId, definitions, day, cancellationToken);
        return [.. definitions.Select(definition => Goal.StandingOn(definition, entries[definition.Id], day))];
    }

    public async Task<Goal?> FindAsync(string id, DateOnly day, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var definitions = await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} AND id = $id", ToDefinition, cancellationToken,
            ("$user", connections.UserId), ("$id", id));
        if (definitions.Count == 0) return null;
        var entries = await EntriesAroundAsync(lease.Connection, connections.UserId, definitions, day, cancellationToken);
        return Goal.StandingOn(definitions[0], entries[id], day);
    }

    public async Task<bool> AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        var definition = goal.Definition;
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var inserted = await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO goals (user_id, id, category_id, title, type, period, target, unit, deadline, tracking)
            VALUES ($user, $id, $categoryId, $title, $type, $period, $target, $unit, $deadline, $tracking)
            ON CONFLICT (user_id, id) DO NOTHING
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", definition.Id), ("$categoryId", definition.CategoryId), ("$title", definition.Title),
            ("$type", ToText(definition.Type)), ("$period", ToText(definition.Period)),
            ("$target", definition.Target), ("$unit", definition.Unit),
            ("$deadline", definition.Deadline?.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$tracking", ToText(definition.Tracking)));
        return inserted > 0;
    }

    public async Task UpdateAsync(GoalDefinition definition, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            UPDATE goals SET title = $title, period = $period, target = $target, unit = $unit,
                deadline = $deadline, tracking = $tracking
            WHERE user_id = $user AND id = $id
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", definition.Id), ("$title", definition.Title), ("$period", ToText(definition.Period)),
            ("$target", definition.Target), ("$unit", definition.Unit),
            ("$deadline", definition.Deadline?.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$tracking", ToText(definition.Tracking)));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        // The progress entries go with it through ON DELETE CASCADE.
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM goals WHERE user_id = $user AND id = $id", cancellationToken,
            ("$user", connections.UserId), ("$id", id));
    }

    /// <summary>
    /// The log entries of the given goals that can count around the day, by goal id: only the span
    /// covering every goal's window is read, then <see cref="Goal.StandingOn"/> keeps each goal's own.
    /// </summary>
    private static async Task<ILookup<string, GoalProgressEvent>> EntriesAroundAsync(
        SqliteConnection connection, string userId, IReadOnlyList<GoalDefinition> definitions, DateOnly day,
        CancellationToken cancellationToken)
    {
        if (definitions.Count == 0) return Array.Empty<GoalProgressEvent>().ToLookup(entry => entry.GoalId);
        var windows = definitions.Select(definition => GoalWindow.For(definition.Period, day, definition.Deadline)).ToList();
        var entries = await SqliteCommands.QueryAsync(
            connection,
            "SELECT event_id, goal_id, date, amount, source, source_ref FROM goal_progress WHERE user_id = $user AND date >= $start AND date <= $end",
            ToEntry,
            cancellationToken,
            ("$user", userId), ("$start", ToText(windows.Min(window => window.Start))), ("$end", ToText(windows.Max(window => window.End))));
        return entries.ToLookup(entry => entry.GoalId);
    }

    private static GoalProgressEvent ToEntry(SqliteDataReader reader)
    {
        return new GoalProgressEvent(
            EventId: reader.GetString(0),
            GoalId: reader.GetString(1),
            Date: DateOnly.ParseExact(reader.GetString(2), DateFormat, CultureInfo.InvariantCulture),
            Amount: reader.GetInt32(3),
            Source: Enum.Parse<GoalSource>(reader.GetString(4), ignoreCase: true),
            SourceRef: reader.GetString(5));
    }

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);

    private static GoalDefinition ToDefinition(SqliteDataReader reader)
    {
        return new GoalDefinition(
            Id: reader.GetString(0),
            CategoryId: reader.GetString(1),
            Title: reader.GetString(2),
            Type: Enum.Parse<GoalType>(reader.GetString(3), ignoreCase: true),
            Period: Enum.Parse<GoalPeriod>(reader.GetString(4), ignoreCase: true),
            Target: reader.GetInt32(5),
            Unit: reader.IsDBNull(6) ? null : reader.GetString(6),
            Deadline: reader.IsDBNull(7) ? null : DateOnly.ParseExact(reader.GetString(7), DateFormat, CultureInfo.InvariantCulture),
            Tracking: Enum.Parse<GoalTracking>(reader.GetString(8), ignoreCase: true));
    }

    private static string ToText<TEnum>(TEnum value) where TEnum : struct, Enum
    {
        return value.ToString().ToLowerInvariant();
    }
}
