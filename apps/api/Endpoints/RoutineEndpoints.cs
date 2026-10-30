using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Endpoints;

public sealed record RoutineBlockRequest(string Id, string Name, string Start, string End, string? CategoryId = null);

/// <summary>Body of <c>PUT /routines/{routineId}</c>; the id comes from the route.</summary>
public sealed record SaveRoutineRequest(
    string Name, int[] Days, string Start, string End, RoutineBlockRequest[] Blocks)
{
    public SaveRoutineCommand ToCommand(string routineId) => new(
        routineId, Name, Days, Start, End,
        Blocks.Select(block => new SaveRoutineBlockCommand(block.Id, block.Name, block.Start, block.End, block.CategoryId))
            .ToList());
}

public sealed record RoutineBlockResponse(string Id, string Name, string Start, string End, string? CategoryId)
{
    public static RoutineBlockResponse From(RoutineBlock block) =>
        new(block.Id, block.Name, block.Start, block.End, block.CategoryId);
}

public sealed record RoutineResponse(
    string Id, string Name, int[] Days, string Start, string End, RoutineBlockResponse[] Blocks)
{
    public static RoutineResponse From(Routine routine) => new(
        routine.Id, routine.Name, [.. routine.Days], routine.Start, routine.End,
        [.. routine.Blocks.Select(RoutineBlockResponse.From)]);
}

/// <summary>HTTP routes for routines.</summary>
public static class RoutineEndpoints
{
    /// <summary>
    /// Maps <c>GET /routines</c>, <c>PUT /routines/{routineId}</c> and <c>DELETE /routines/{routineId}</c>.
    /// </summary>
    /// <example><code>app.MapRoutineEndpoints();</code></example>
    public static IEndpointRouteBuilder MapRoutineEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/routines", ListAsync);
        routes.MapPut("/routines/{routineId}", SaveAsync);
        routes.MapDelete("/routines/{routineId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> DeleteAsync(
        string routineId, DeleteRoutine deleteRoutine, CancellationToken cancellationToken)
    {
        await deleteRoutine.ExecuteAsync(routineId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListAsync(ListRoutines listRoutines, CancellationToken cancellationToken)
    {
        var routines = await listRoutines.ExecuteAsync(cancellationToken);
        return Results.Ok(routines.Select(RoutineResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string routineId, SaveRoutineRequest request, SaveRoutine saveRoutine, CancellationToken cancellationToken)
    {
        var routine = await saveRoutine.ExecuteAsync(request.ToCommand(routineId), cancellationToken);
        return Results.Ok(RoutineResponse.From(routine));
    }
}
