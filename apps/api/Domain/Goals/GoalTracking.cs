namespace Budgeter.Api.Domain.Goals;

/// <summary>What feeds a goal's progress; it follows from the goal's type and is never chosen.</summary>
public enum GoalTracking
{
    /// <summary>An objective: the user marks it achieved.</summary>
    Manual,

    /// <summary>A frequency goal: every completed routine block of the goal's category counts once.</summary>
    Blocks,

    /// <summary>No longer assigned; kept so goals stored with it still read.</summary>
    Tasks,
}
