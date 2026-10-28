using System.Globalization;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Goals stored in the <c>goals</c> table (enums as lower-case names). A goal's progress is not stored
/// on it: it is the sum of its <c>goal_progress</c> entries inside the period around the requested day.
/// </summary>
public sealed class SqliteGoalRepository(SqliteConnectionFactory connections) : IGoalRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string SelectColumns =
        "SELECT id, category_id, title, type, period, target, unit, deadline, tracking FROM goals";

    public async Task<IReadOnlyList<Goal>> ListAsync(DateOnly day, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var definitions = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} ORDER BY rowid", ToDefinition, cancellationToken);
        var goals = new List<Goal>(definitions.Count);
        foreach (var definition in definitions) goals.Add(await WithProgressAsync(connection, definition, day, cancellationToken));
        return goals;
    }

    public async Task<Goal?> FindAsync(string id, DateOnly day, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} WHERE id = $id", ToDefinition, cancellationToken, ("$id", id));
        return rows.Count == 0 ? null : await WithProgressAsync(connection, rows[0], day, cancellationToken);
    }

    public async Task AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        var definition = goal.Definition;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO goals (id, category_id, title, type, period, target, unit, deadline, tracking)
            VALUES ($id, $categoryId, $title, $type, $period, $target, $unit, $deadline, $tracking)
            """,
            cancellationToken,
            ("$id", definition.Id), ("$categoryId", definition.CategoryId), ("$title", definition.Title),
            ("$type", ToText(definition.Type)), ("$period", ToText(definition.Period)),
            ("$target", definition.Target), ("$unit", definition.Unit),
            ("$deadline", definition.Deadline?.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$tracking", ToText(definition.Tracking)));
    }

    public async Task UpdateAsync(GoalDefinition definition, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            UPDATE goals SET title = $title, period = $period, target = $target, unit = $unit,
                deadline = $deadline, tracking = $tracking
            WHERE id = $id
            """,
            cancellationToken,
            ("$id", definition.Id), ("$title", definition.Title), ("$period", ToText(definition.Period)),
            ("$target", definition.Target), ("$unit", definition.Unit),
            ("$deadline", definition.Deadline?.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$tracking", ToText(definition.Tracking)));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        // The progress entries go with it through ON DELETE CASCADE.
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM goals WHERE id = $id", cancellationToken, ("$id", id));
    }

    private static async Task<Goal> WithProgressAsync(
        SqliteConnection connection, GoalDefinition definition, DateOnly day, CancellationToken cancellationToken)
    {
        var window = GoalWindow.For(definition.Period, day, definition.Deadline);
        // Only entries from the source the goal is tracked from count, so entries left over from an
        // earlier setting (or from a change that raced with a completion) never add up.
        var totals = await SqliteCommands.QueryAsync(
            connection,
            """
            SELECT COALESCE(SUM(CASE WHEN source = 'manual' THEN amount ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN source = $automaticSource THEN amount ELSE 0 END), 0)
            FROM goal_progress WHERE goal_id = $id AND date >= $start AND date <= $end
            """,
            reader => (Manual: reader.GetInt32(0), Automatic: reader.GetInt32(1)),
            cancellationToken,
            ("$id", definition.Id),
            ("$automaticSource", AutomaticSourceOf(definition.Tracking)),
            ("$start", window.Start.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$end", window.End.ToString(DateFormat, CultureInfo.InvariantCulture)));
        var (manual, automatic) = totals[0];
        return Goal.Restore(definition, GoalProgress.Compute(definition.Target, manual, automatic));
    }

    /// <summary>The progress source a tracking counts; "manual" progress is summed separately, so it matches nothing here.</summary>
    private static string AutomaticSourceOf(GoalTracking tracking) => tracking switch
    {
        GoalTracking.Blocks => "block",
        GoalTracking.Tasks => "task",
        _ => string.Empty,
    };

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
