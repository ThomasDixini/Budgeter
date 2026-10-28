using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>
/// Port to the log of goal progress. Every write is idempotent (an entry id counts once, removing
/// what is not there does nothing), so a retried request repairs a half-finished one.
/// </summary>
public interface IGoalProgressLedger
{
    /// <summary>Adds the entry unless one with the same id is already logged.</summary>
    Task RecordAsync(GoalProgressEvent entry, CancellationToken cancellationToken);

    /// <summary>
    /// Adds a negative manual entry only if the goal's manual progress inside the window stays at or
    /// above zero, deciding and writing in one step so two take-backs at once cannot both pass.
    /// </summary>
    Task TakeBackAsync(GoalProgressEvent entry, GoalWindow window, CancellationToken cancellationToken);

    /// <summary>Removes the entries a block or task produced on a day, from every goal.</summary>
    Task RemoveBySourceAsync(GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken);

    /// <summary>Removes every block and task entry of a goal, keeping the manual ones.</summary>
    Task RemoveAutomaticAsync(string goalId, CancellationToken cancellationToken);
}
