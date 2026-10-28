namespace Budgeter.Api.Domain.Goals;

/// <summary>What feeds a goal's progress. Only frequency goals can be fed automatically.</summary>
public enum GoalTracking
{
    /// <summary>The user logs each repetition by hand.</summary>
    Manual,

    /// <summary>Every completed routine block of the goal's category counts once.</summary>
    Blocks,

    /// <summary>Every completed task of the goal's category counts once.</summary>
    Tasks,
}
