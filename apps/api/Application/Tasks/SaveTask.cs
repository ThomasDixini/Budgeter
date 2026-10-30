using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Tasks;

namespace Budgeter.Api.Application.Tasks;

public sealed record SaveTaskCommand(
    string Id, string Title, string? CategoryId, TaskRepeat Repeat, IReadOnlyList<int> Days, DateOnly? Date);

/// <summary>Creates or replaces a task; saving the same task twice leaves the same state.</summary>
public sealed class SaveTask(ITaskRepository tasks, ICategoryRepository categories)
{
    /// <summary>
    /// Validates the task, checks its category exists and stores it.
    /// </summary>
    /// <example><code>await saveTask.ExecuteAsync(new SaveTaskCommand("t1", "Read", "reading", TaskRepeat.Daily, [], null), ct);</code></example>
    public async Task<TaskItem> ExecuteAsync(SaveTaskCommand command, CancellationToken cancellationToken)
    {
        var task = TaskItem.Create(
            command.Id, command.Title, command.CategoryId, command.Repeat, command.Days, command.Date);
        if (task.CategoryId is not null) await RequireCategoryAsync(task.CategoryId, cancellationToken);
        await tasks.SaveAsync(task, cancellationToken);
        return task;
    }

    private async Task RequireCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(categoryId, cancellationToken);
        if (category is null) throw ResourceNotFoundException.For("category", categoryId);
    }
}

