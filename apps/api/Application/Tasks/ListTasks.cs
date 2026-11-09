using Orbit.Api.Domain.Tasks;

namespace Orbit.Api.Application.Tasks;

/// <summary>Lists every task in creation order.</summary>
public sealed class ListTasks(ITaskRepository tasks)
{
    /// <summary>
    /// Returns all tasks; the client decides which ones show up on a day.
    /// </summary>
    /// <example><code>var all = await listTasks.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<TaskItem>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return tasks.ListAsync(cancellationToken);
    }
}
