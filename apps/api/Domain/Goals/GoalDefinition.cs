namespace Budgeter.Api.Domain.Goals;

/// <summary>Everything the user decides when setting a goal, before any progress exists.</summary>
public sealed record GoalDefinition(
    string Id,
    string CategoryId,
    string Title,
    GoalType Type,
    GoalPeriod Period,
    int Target,
    string? Unit,
    DateOnly? Deadline,
    GoalTracking Tracking = GoalTracking.Manual);
