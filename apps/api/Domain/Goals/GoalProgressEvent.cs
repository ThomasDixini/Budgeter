namespace Budgeter.Api.Domain.Goals;

/// <summary>
/// One entry of a goal's progress log. Progress is the sum of the entries inside the goal's current
/// period, so nothing is ever reset: a new week simply has no entries yet.
/// </summary>
/// <param name="EventId">Unique and chosen by the caller, so repeating a request cannot count twice.</param>
/// <param name="Date">The local day it counts for.</param>
/// <param name="Amount">Positive to add progress, negative to take manual progress back.</param>
/// <param name="SourceRef">What produced it (a block or a task), empty for manual entries.</param>
public sealed record GoalProgressEvent(
    string EventId, string GoalId, DateOnly Date, int Amount, GoalSource Source, string SourceRef);
