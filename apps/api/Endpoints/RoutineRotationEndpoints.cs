using Orbit.Api.Application.Routines;
using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Endpoints;

public sealed record RotationStepBody(string RoutineId, int Weeks)
{
    public static RotationStepBody From(RotationStep step) => new(step.RoutineId, step.Weeks);

    public RotationStepCommand ToCommand() => new(RoutineId, Weeks);
}

/// <summary>Body of <c>PUT /routine-rotation</c> and what <c>GET /routine-rotation</c> answers with.</summary>
public sealed record RoutineRotationBody(DateOnly StartsOn, IReadOnlyList<RotationStepBody> Steps)
{
    public static RoutineRotationBody From(RoutineRotation rotation) =>
        new(rotation.StartsOn, rotation.Steps.Select(RotationStepBody.From).ToList());

    public SaveRoutineRotationCommand ToCommand() => new(StartsOn, Steps.Select(step => step.ToCommand()).ToList());
}

/// <summary>HTTP routes for the routine rotation.</summary>
public static class RoutineRotationEndpoints
{
    /// <summary>
    /// Maps <c>GET /routine-rotation</c> and <c>PUT /routine-rotation</c> (which replaces the whole rotation).
    /// </summary>
    /// <example><code>app.MapRoutineRotationEndpoints();</code></example>
    public static IEndpointRouteBuilder MapRoutineRotationEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/routine-rotation", GetAsync);
        routes.MapPut("/routine-rotation", SaveAsync);
        return routes;
    }

    private static async Task<IResult> GetAsync(GetRoutineRotation getRoutineRotation, CancellationToken cancellationToken)
    {
        return Results.Ok(RoutineRotationBody.From(await getRoutineRotation.ExecuteAsync(cancellationToken)));
    }

    private static async Task<IResult> SaveAsync(
        RoutineRotationBody request, SaveRoutineRotation saveRoutineRotation, CancellationToken cancellationToken)
    {
        var rotation = await saveRoutineRotation.ExecuteAsync(request.ToCommand(), cancellationToken);
        return Results.Ok(RoutineRotationBody.From(rotation));
    }
}
