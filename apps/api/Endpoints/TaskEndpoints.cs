using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Tasks;

namespace Budgeter.Api.Endpoints;

/// <summary>Body of <c>PUT /tasks/{taskId}</c>; the id comes from the route.</summary>
public sealed record SaveTaskRequest(
    string Title, TaskRepeat Repeat, string? CategoryId = null, int[]? Days = null, DateOnly? Date = null)
{
    public SaveTaskCommand ToCommand(string taskId) => new(taskId, Title, CategoryId, Repeat, Days ?? [], Date);
}

public sealed record TaskResponse(
    string Id, string Title, string? CategoryId, TaskRepeat Repeat, int[] Days, DateOnly? Date)
{
    public static TaskResponse From(TaskItem task) =>
        new(task.Id, task.Title, task.CategoryId, task.Repeat, [.. task.Days], task.Date);
}

/// <summary>HTTP routes for tasks and the days they were done.</summary>
public static class TaskEndpoints
{
    /// <summary>
    /// Maps <c>GET /tasks</c>, <c>PUT</c>/<c>DELETE /tasks/{taskId}</c>, <c>GET /task-completions?date=</c>
    /// and <c>PUT</c>/<c>DELETE /tasks/{taskId}/completions/{date}</c>.
    /// </summary>
    /// <example><code>app.MapTaskEndpoints();</code></example>
    public static IEndpointRouteBuilder MapTaskEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/tasks", ListAsync);
        routes.MapPut("/tasks/{taskId}", SaveAsync);
        routes.MapDelete("/tasks/{taskId}", DeleteAsync);
        routes.MapGet("/task-completions", ListCompletedAsync);
        routes.MapPut("/tasks/{taskId}/completions/{date}", MarkDoneAsync);
        routes.MapDelete("/tasks/{taskId}/completions/{date}", UnmarkDoneAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListTasks listTasks, CancellationToken cancellationToken)
    {
        var tasks = await listTasks.ExecuteAsync(cancellationToken);
        return Results.Ok(tasks.Select(TaskResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string taskId, SaveTaskRequest request, SaveTask saveTask, CancellationToken cancellationToken)
    {
        var task = await saveTask.ExecuteAsync(request.ToCommand(taskId), cancellationToken);
        return Results.Ok(TaskResponse.From(task));
    }

    private static async Task<IResult> DeleteAsync(string taskId, DeleteTask deleteTask, CancellationToken cancellationToken)
    {
        await deleteTask.ExecuteAsync(taskId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListCompletedAsync(
        DateOnly date, TaskCompletions completions, CancellationToken cancellationToken)
    {
        return Results.Ok(await completions.ListAsync(date, cancellationToken));
    }

    private static async Task<IResult> MarkDoneAsync(
        string taskId, DateOnly date, TaskCompletions completions, CancellationToken cancellationToken)
    {
        await completions.SetAsync(taskId, date, isDone: true, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> UnmarkDoneAsync(
        string taskId, DateOnly date, TaskCompletions completions, CancellationToken cancellationToken)
    {
        await completions.SetAsync(taskId, date, isDone: false, cancellationToken);
        return Results.NoContent();
    }
}
