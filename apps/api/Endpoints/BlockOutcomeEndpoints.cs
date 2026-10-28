using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Endpoints;

/// <summary>Body of <c>PUT /routines/{routineId}/days/{date}/blocks/{blockId}</c>.</summary>
public sealed record RecordBlockOutcomeRequest(BlockOutcomeKind Outcome, string At);

public sealed record BlockOutcomeResponse(string RoutineId, string BlockId, BlockOutcomeKind Outcome, string At)
{
    public static BlockOutcomeResponse From(BlockOutcome outcome) =>
        new(outcome.RoutineId, outcome.BlockId, outcome.Kind, outcome.At);
}

/// <summary>HTTP routes for routine blocks completed or skipped on a day.</summary>
public static class BlockOutcomeEndpoints
{
    /// <summary>
    /// Maps <c>GET /block-outcomes?date=</c> and <c>PUT</c>/<c>DELETE /routines/{routineId}/days/{date}/blocks/{blockId}</c>.
    /// </summary>
    /// <example><code>app.MapBlockOutcomeEndpoints();</code></example>
    public static IEndpointRouteBuilder MapBlockOutcomeEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/block-outcomes", ListAsync);
        routes.MapPut("/routines/{routineId}/days/{date}/blocks/{blockId}", RecordAsync);
        routes.MapDelete("/routines/{routineId}/days/{date}/blocks/{blockId}", UndoAsync);
        return routes;
    }

    private static async Task<IResult> UndoAsync(
        string routineId, DateOnly date, string blockId, UndoBlockOutcome undoBlockOutcome,
        CancellationToken cancellationToken)
    {
        await undoBlockOutcome.ExecuteAsync(routineId, blockId, date, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListAsync(
        DateOnly date, ListBlockOutcomes listBlockOutcomes, CancellationToken cancellationToken)
    {
        var outcomes = await listBlockOutcomes.ExecuteAsync(date, cancellationToken);
        return Results.Ok(outcomes.Select(BlockOutcomeResponse.From));
    }

    private static async Task<IResult> RecordAsync(
        string routineId,
        DateOnly date,
        string blockId,
        RecordBlockOutcomeRequest request,
        RecordBlockOutcome recordBlockOutcome,
        CancellationToken cancellationToken)
    {
        var outcome = await recordBlockOutcome.ExecuteAsync(
            new RecordBlockOutcomeCommand(routineId, blockId, date, request.Outcome, request.At), cancellationToken);
        return Results.Ok(BlockOutcomeResponse.From(outcome));
    }
}
