using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Endpoints;

public sealed record CreateGoalRequest(
    string Id,
    string CategoryId,
    string Title,
    GoalType Type,
    GoalPeriod Period,
    int Target,
    string? Unit = null,
    DateOnly? Deadline = null)
{
    public GoalDefinition ToDefinition() => new(Id, CategoryId, Title, Type, Period, Target, Unit, Deadline);
}

public sealed record GoalResponse(
    string Id,
    string CategoryId,
    string Title,
    GoalType Type,
    GoalPeriod Period,
    int Target,
    int Done,
    string? Unit,
    DateOnly? Deadline)
{
    public static GoalResponse From(Goal goal)
    {
        var definition = goal.Definition;
        return new GoalResponse(
            definition.Id, definition.CategoryId, definition.Title, definition.Type, definition.Period,
            definition.Target, goal.Done, definition.Unit, definition.Deadline);
    }
}

/// <summary>HTTP routes for goals and their progress.</summary>
public static class GoalEndpoints
{
    /// <summary>
    /// Maps <c>GET /goals</c>, <c>POST /goals</c> and <c>POST /goals/{goalId}/progress</c>.
    /// </summary>
    /// <example><code>app.MapGoalEndpoints();</code></example>
    public static IEndpointRouteBuilder MapGoalEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/goals", ListAsync);
        routes.MapPost("/goals", CreateAsync);
        routes.MapPost("/goals/{goalId}/progress", LogProgressAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListGoals listGoals, CancellationToken cancellationToken)
    {
        var goals = await listGoals.ExecuteAsync(cancellationToken);
        return Results.Ok(goals.Select(GoalResponse.From));
    }

    private static async Task<IResult> CreateAsync(
        CreateGoalRequest request, CreateGoal createGoal, CancellationToken cancellationToken)
    {
        var creation = await createGoal.ExecuteAsync(request.ToDefinition(), cancellationToken);
        var response = GoalResponse.From(creation.Record);
        return creation.WasCreated ? Results.Created($"/goals/{response.Id}", response) : Results.Ok(response);
    }

    private static async Task<IResult> LogProgressAsync(
        string goalId, LogGoalProgress logGoalProgress, CancellationToken cancellationToken)
    {
        var goal = await logGoalProgress.ExecuteAsync(goalId, cancellationToken);
        return Results.Ok(GoalResponse.From(goal));
    }
}
