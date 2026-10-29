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

/// <summary>Body of <c>PUT /goals/{goalId}</c>; the id comes from the route, type and category cannot change.</summary>
public sealed record UpdateGoalRequest(
    string Title,
    GoalPeriod Period,
    int Target,
    string? Unit = null,
    DateOnly? Deadline = null)
{
    public UpdateGoalCommand ToCommand(string goalId, DateOnly day) =>
        new(goalId, Title, Period, Target, Unit, Deadline, day);
}

/// <summary>Body of <c>PUT /goals/{goalId}/achievement</c>: whether the objective is achieved.</summary>
/// <param name="Date">The client's local day it was achieved on.</param>
public sealed record SetGoalAchievementRequest(DateOnly Date, bool Achieved);

public sealed record GoalResponse(
    string Id,
    string CategoryId,
    string Title,
    GoalType Type,
    GoalPeriod Period,
    int Target,
    int Done,
    string? Unit,
    DateOnly? Deadline,
    GoalTracking Tracking,
    DateOnly? AchievedOn = null)
{
    public static GoalResponse From(Goal goal)
    {
        var definition = goal.Definition;
        return new GoalResponse(
            definition.Id, definition.CategoryId, definition.Title, definition.Type, definition.Period,
            definition.Target, goal.Done, definition.Unit, definition.Deadline, definition.Tracking, goal.AchievedOn);
    }
}

/// <summary>
/// HTTP routes for goals and their progress. Every route that answers with a goal takes the client's
/// local <c>date</c>, because a goal's progress is the one of the period around that day.
/// </summary>
public static class GoalEndpoints
{
    /// <summary>
    /// Maps <c>GET /goals?date=</c>, <c>POST /goals?date=</c>, <c>PUT /goals/{goalId}?date=</c>,
    /// <c>DELETE /goals/{goalId}</c> and <c>PUT /goals/{goalId}/achievement</c>.
    /// </summary>
    /// <example><code>app.MapGoalEndpoints();</code></example>
    public static IEndpointRouteBuilder MapGoalEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/goals", ListAsync);
        routes.MapPost("/goals", CreateAsync);
        routes.MapPut("/goals/{goalId}", UpdateAsync);
        routes.MapDelete("/goals/{goalId}", DeleteAsync);
        routes.MapPut("/goals/{goalId}/achievement", SetAchievementAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        DateOnly date, ListGoals listGoals, CancellationToken cancellationToken)
    {
        var goals = await listGoals.ExecuteAsync(date, cancellationToken);
        return Results.Ok(goals.Select(GoalResponse.From));
    }

    private static async Task<IResult> CreateAsync(
        DateOnly date, CreateGoalRequest request, CreateGoal createGoal, CancellationToken cancellationToken)
    {
        var creation = await createGoal.ExecuteAsync(request.ToDefinition(), date, cancellationToken);
        var response = GoalResponse.From(creation.Record);
        return creation.WasCreated ? Results.Created($"/goals/{response.Id}", response) : Results.Ok(response);
    }

    private static async Task<IResult> UpdateAsync(
        string goalId, DateOnly date, UpdateGoalRequest request, UpdateGoal updateGoal,
        CancellationToken cancellationToken)
    {
        var goal = await updateGoal.ExecuteAsync(request.ToCommand(goalId, date), cancellationToken);
        return Results.Ok(GoalResponse.From(goal));
    }

    private static async Task<IResult> DeleteAsync(string goalId, DeleteGoal deleteGoal, CancellationToken cancellationToken)
    {
        await deleteGoal.ExecuteAsync(goalId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SetAchievementAsync(
        string goalId, SetGoalAchievementRequest request, SetGoalAchievement setGoalAchievement,
        CancellationToken cancellationToken)
    {
        var goal = await setGoalAchievement.ExecuteAsync(
            new SetGoalAchievementCommand(goalId, request.Date, request.Achieved), cancellationToken);
        return Results.Ok(GoalResponse.From(goal));
    }
}
