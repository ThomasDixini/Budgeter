using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Tasks;

/// <summary>
/// Reads and records which tasks were done on a day. Checking a task off counts toward the goals of
/// its category that are tracked from tasks; unchecking it takes that back.
/// </summary>
public sealed class TaskCompletions(ITaskRepository tasks, GoalCredits goalCredits)
{
    /// <summary>
    /// Ids of the tasks done on a day.
    /// </summary>
    /// <example><code>await taskCompletions.ListAsync(new DateOnly(2026, 10, 27), ct); // ["t1"]</code></example>
    public Task<IReadOnlyList<string>> ListAsync(DateOnly day, CancellationToken cancellationToken)
    {
        return tasks.ListCompletedAsync(day, cancellationToken);
    }

    /// <summary>
    /// Marks or unmarks an existing task as done on a day, and updates the goals of its category.
    /// </summary>
    /// <example><code>await taskCompletions.SetAsync("t1", new DateOnly(2026, 10, 27), isDone: true, ct);</code></example>
    public async Task SetAsync(string taskId, DateOnly day, bool isDone, CancellationToken cancellationToken)
    {
        var task = await tasks.FindAsync(taskId, cancellationToken)
            ?? throw ResourceNotFoundException.For("task", taskId);
        await tasks.SetCompletedAsync(task.Id, day, isDone, cancellationToken);
        if (isDone)
        {
            await goalCredits.CreditAsync(GoalSource.Task, task.Id, task.CategoryId, day, cancellationToken);
            return;
        }
        await goalCredits.RevokeAsync(GoalSource.Task, task.Id, day, cancellationToken);
    }
}
