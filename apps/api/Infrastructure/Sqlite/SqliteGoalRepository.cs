using System.Globalization;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Goals stored in the <c>goals</c> table; enums are kept as lower-case names.</summary>
public sealed class SqliteGoalRepository(SqliteConnectionFactory connections) : IGoalRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string SelectColumns =
        "SELECT id, category_id, title, type, period, target, unit, deadline, done FROM goals";

    public async Task<IReadOnlyList<Goal>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} ORDER BY rowid", ToGoal, cancellationToken);
    }

    public async Task<Goal?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} WHERE id = $id", ToGoal, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        var definition = goal.Definition;
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO goals (id, category_id, title, type, period, target, unit, deadline, done)
            VALUES ($id, $categoryId, $title, $type, $period, $target, $unit, $deadline, $done)
            """,
            cancellationToken,
            ("$id", definition.Id), ("$categoryId", definition.CategoryId), ("$title", definition.Title),
            ("$type", ToText(definition.Type)), ("$period", ToText(definition.Period)),
            ("$target", definition.Target), ("$unit", definition.Unit),
            ("$deadline", definition.Deadline?.ToString(DateFormat, CultureInfo.InvariantCulture)),
            ("$done", goal.Done));
    }

    public async Task SaveProgressAsync(Goal goal, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            "UPDATE goals SET done = $done WHERE id = $id",
            cancellationToken,
            ("$done", goal.Done), ("$id", goal.Id));
    }

    private static Goal ToGoal(SqliteDataReader reader)
    {
        var definition = new GoalDefinition(
            Id: reader.GetString(0),
            CategoryId: reader.GetString(1),
            Title: reader.GetString(2),
            Type: Enum.Parse<GoalType>(reader.GetString(3), ignoreCase: true),
            Period: Enum.Parse<GoalPeriod>(reader.GetString(4), ignoreCase: true),
            Target: reader.GetInt32(5),
            Unit: reader.IsDBNull(6) ? null : reader.GetString(6),
            Deadline: reader.IsDBNull(7) ? null : DateOnly.ParseExact(reader.GetString(7), DateFormat, CultureInfo.InvariantCulture));
        return Goal.Restore(definition, reader.GetInt32(8));
    }

    private static string ToText<TEnum>(TEnum value) where TEnum : struct, Enum
    {
        return value.ToString().ToLowerInvariant();
    }
}
