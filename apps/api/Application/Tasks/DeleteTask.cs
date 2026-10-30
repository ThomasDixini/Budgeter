using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Tasks;

/// <summary>Deletes a task and its history; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteTask(ITaskRepository tasks)
{
    /// <summary>
    /// Validates the id and removes the task if it exists.
    /// </summary>
    /// <example><code>await deleteTask.ExecuteAsync("t1", ct);</code></example>
    public Task ExecuteAsync(string taskId, CancellationToken cancellationToken)
    {
        return tasks.DeleteAsync(EntityId.Require(taskId, "task id"), cancellationToken);
    }
}

