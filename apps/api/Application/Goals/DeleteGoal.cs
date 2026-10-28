using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Goals;

/// <summary>Deletes a goal and its progress; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteGoal(IGoalRepository goals)
{
    /// <summary>
    /// Validates the id and removes the goal if it exists.
    /// </summary>
    /// <example><code>await deleteGoal.ExecuteAsync("g1", ct);</code></example>
    public Task ExecuteAsync(string goalId, CancellationToken cancellationToken)
    {
        return goals.DeleteAsync(EntityId.Require(goalId, "goal id"), cancellationToken);
    }
}
