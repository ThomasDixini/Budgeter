using System.Globalization;
using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Tasks;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Tasks stored in the <c>tasks</c> table (weekdays kept as "0,2,4", repeat as a lower-case name)
/// and the days they were done in <c>task_completions</c>.
/// </summary>
public sealed class SqliteTaskRepository(SqliteConnectionFactory connections) : ITaskRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const char DaySeparator = ',';
    private const string SelectColumns = "SELECT id, title, category_id, repeat, days, date FROM tasks";

    public async Task<IReadOnlyList<TaskItem>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(connection, $"{SelectColumns} ORDER BY rowid", ToTask, cancellationToken);
    }

    public async Task<TaskItem?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} WHERE id = $id", ToTask, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task SaveAsync(TaskItem task, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await WriteAsync(connection, task, cancellationToken);
    }

    public async Task DeleteAsync(string taskId, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        // Completions go with it through ON DELETE CASCADE.
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM tasks WHERE id = $id", cancellationToken, ("$id", taskId));
    }

    public async Task<IReadOnlyList<string>> ListCompletedAsync(DateOnly day, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            connection, "SELECT task_id FROM task_completions WHERE date = $date ORDER BY rowid",
            reader => reader.GetString(0), cancellationToken, ("$date", ToText(day)));
    }

    public async Task SetCompletedAsync(string taskId, DateOnly day, bool isDone, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var sql = isDone
            ? "INSERT OR IGNORE INTO task_completions (task_id, date) VALUES ($taskId, $date)"
            : "DELETE FROM task_completions WHERE task_id = $taskId AND date = $date";
        await SqliteCommands.ExecuteAsync(
            connection, sql, cancellationToken, ("$taskId", taskId), ("$date", ToText(day)));
    }

    /// <summary>
    /// Upserts a task row, keeping its position in the list.
    /// </summary>
    /// <example><code>await SqliteTaskRepository.WriteAsync(connection, task, ct);</code></example>
    internal static Task WriteAsync(SqliteConnection connection, TaskItem task, CancellationToken cancellationToken)
    {
        return SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO tasks (id, title, category_id, repeat, days, date) VALUES ($id, $title, $categoryId, $repeat, $days, $date)
            ON CONFLICT (id) DO UPDATE SET
                title = excluded.title, category_id = excluded.category_id, repeat = excluded.repeat,
                days = excluded.days, date = excluded.date
            """,
            cancellationToken,
            ("$id", task.Id), ("$title", task.Title), ("$categoryId", task.CategoryId),
            ("$repeat", task.Repeat.ToString().ToLowerInvariant()), ("$days", string.Join(DaySeparator, task.Days)),
            ("$date", task.Date is { } date ? ToText(date) : null));
    }

    private static TaskItem ToTask(SqliteDataReader reader)
    {
        return TaskItem.Create(
            reader.GetString(0),
            reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetString(2),
            Enum.Parse<TaskRepeat>(reader.GetString(3), ignoreCase: true),
            reader.GetString(4).Split(DaySeparator, StringSplitOptions.RemoveEmptyEntries)
                .Select(day => int.Parse(day, CultureInfo.InvariantCulture)),
            reader.IsDBNull(5) ? null : DateOnly.ParseExact(reader.GetString(5), DateFormat, CultureInfo.InvariantCulture));
    }

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
