using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Tasks;

/// <summary>
/// Reads and records which tasks were done on a day. Tasks do not feed goals: only completed routine
/// blocks do.
/// </summary>
public sealed class TaskCompletions(ITaskRepository tasks)
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
    /// Marks an existing task as done on a day, or unmarks it. Unmarking a task deleted since succeeds:
    /// there is nothing left to unmark, so a replayed request is harmless.
    /// </summary>
    /// <example><code>await taskCompletions.SetAsync("t1", new DateOnly(2026, 10, 27), isDone: true, ct);</code></example>
    public async Task SetAsync(string taskId, DateOnly day, bool isDone, CancellationToken cancellationToken)
    {
        var validTaskId = EntityId.Require(taskId, "task id");
        if (isDone) await RequireTaskAsync(validTaskId, cancellationToken);
        await tasks.SetCompletedAsync(validTaskId, day, isDone, cancellationToken);
    }

    private async Task RequireTaskAsync(string taskId, CancellationToken cancellationToken)
    {
        var task = await tasks.FindAsync(taskId, cancellationToken);
        if (task is null) throw ResourceNotFoundException.For("task", taskId);
    }
}
