namespace Budgeter.Api.Domain.Tasks;

/// <summary>
/// A to-do on the Today list: once on a given date, every day, or on some weekdays. Named
/// TaskItem so it never shadows <see cref="System.Threading.Tasks.Task"/>.
/// </summary>
public sealed class TaskItem
{
    public const int MaxTitleLength = 80;
    private const int DaysPerWeek = 7;

    public string Id { get; }
    public string Title { get; }
    public string? CategoryId { get; }
    public TaskRepeat Repeat { get; }

    /// <summary>Weekday indexes in ascending order, Monday = 0; only for weekly tasks.</summary>
    public IReadOnlyList<int> Days { get; }

    /// <summary>The single day of a task that happens once.</summary>
    public DateOnly? Date { get; }

    private TaskItem(
        string id, string title, string? categoryId, TaskRepeat repeat, IReadOnlyList<int> days, DateOnly? date)
    {
        Id = id;
        Title = title;
        CategoryId = categoryId;
        Repeat = repeat;
        Days = days;
        Date = date;
    }

    /// <summary>
    /// Builds a valid task: a date only for one-off tasks, weekdays only (and at least one) for weekly ones.
    /// </summary>
    /// <example><code>TaskItem.Create("t1", "Read 20 pages", "reading", TaskRepeat.Daily, [], null).Days.Count; // 0</code></example>
    public static TaskItem Create(
        string id, string title, string? categoryId, TaskRepeat repeat, IEnumerable<int> days, DateOnly? date)
    {
        return new TaskItem(
            EntityId.Require(id, "task id"),
            RequiredText.Require(title, MaxTitleLength, "task title"),
            categoryId is null ? null : EntityId.Require(categoryId, "task category id"),
            repeat,
            RequireDays(repeat, days),
            RequireDate(repeat, date));
    }

    /// <summary>
    /// Rebuilds a stored task as it was saved, without today's rules, so a stricter rule never makes an
    /// old task unreadable.
    /// </summary>
    /// <example><code>TaskItem.Restore("t1", "Read 20 pages", "reading", TaskRepeat.Daily, [], null);</code></example>
    internal static TaskItem Restore(
        string id, string title, string? categoryId, TaskRepeat repeat, IEnumerable<int> days, DateOnly? date) =>
        new(id, title, categoryId, repeat, days.ToList(), date);

    private static List<int> RequireDays(TaskRepeat repeat, IEnumerable<int> days)
    {
        var sorted = days.Distinct().Order().ToList();
        if (repeat != TaskRepeat.Weekly) return [];
        if (sorted.Count == 0 || sorted.Exists(day => day is < 0 or >= DaysPerWeek))
        {
            throw new DomainRuleException(
                $"Expected a weekly task to repeat on weekdays from 0 (Monday) to 6 (Sunday), received [{string.Join(", ", sorted)}]");
        }
        return sorted;
    }

    private static DateOnly? RequireDate(TaskRepeat repeat, DateOnly? date)
    {
        if (repeat != TaskRepeat.Once) return null;
        return date ?? throw new DomainRuleException(
            "Expected a task that happens once to have a date shaped like YYYY-MM-DD, received none");
    }
}
