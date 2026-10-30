using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Tasks;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Task storage kept in lists, for use case tests.</summary>
internal sealed class InMemoryTaskRepository : ITaskRepository
{
    private readonly List<TaskItem> _tasks = [];
    private readonly HashSet<(string TaskId, DateOnly Day)> _completions = [];

    public InMemoryTaskRepository(params TaskItem[] tasks)
    {
        _tasks.AddRange(tasks);
    }

    public Task<IReadOnlyList<TaskItem>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<TaskItem>>(_tasks.ToList());
    }

    public Task<TaskItem?> FindAsync(string id, CancellationToken cancellationToken)
    {
        return Task.FromResult(_tasks.Find(task => task.Id == id));
    }

    public Task SaveAsync(TaskItem task, CancellationToken cancellationToken)
    {
        var index = _tasks.FindIndex(stored => stored.Id == task.Id);
        if (index < 0) _tasks.Add(task);
        else _tasks[index] = task;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string taskId, CancellationToken cancellationToken)
    {
        _tasks.RemoveAll(task => task.Id == taskId);
        _completions.RemoveWhere(completion => completion.TaskId == taskId);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<string>> ListCompletedAsync(DateOnly day, CancellationToken cancellationToken)
    {
        var ids = _completions.Where(completion => completion.Day == day).Select(completion => completion.TaskId);
        return Task.FromResult<IReadOnlyList<string>>(ids.ToList());
    }

    public Task SetCompletedAsync(string taskId, DateOnly day, bool isDone, CancellationToken cancellationToken)
    {
        if (isDone) _completions.Add((taskId, day));
        else _completions.Remove((taskId, day));
        return Task.CompletedTask;
    }
}
