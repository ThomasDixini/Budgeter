using Budgeter.Api.Domain.Tasks;

namespace Budgeter.Api.Application.Tasks;

/// <summary>Port to the storage of tasks and the days they were done.</summary>
public interface ITaskRepository
{
    /// <summary>All tasks in creation order.</summary>
    Task<IReadOnlyList<TaskItem>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The task with this id, or null when there is none.</summary>
    Task<TaskItem?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores the task, replacing a stored one with the same id.</summary>
    Task SaveAsync(TaskItem task, CancellationToken cancellationToken);

    /// <summary>Removes the task and its completions; an unknown id is ignored.</summary>
    Task DeleteAsync(string taskId, CancellationToken cancellationToken);

    /// <summary>Ids of the tasks marked done on a day.</summary>
    Task<IReadOnlyList<string>> ListCompletedAsync(DateOnly day, CancellationToken cancellationToken);

    /// <summary>Marks or unmarks a task as done on a day; repeating either is harmless.</summary>
    Task SetCompletedAsync(string taskId, DateOnly day, bool isDone, CancellationToken cancellationToken);
}
