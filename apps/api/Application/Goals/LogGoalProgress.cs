using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>Records one more repetition or unit of progress on a goal.</summary>
public sealed class LogGoalProgress(IGoalRepository goals)
{
    /// <summary>
    /// Increments the goal (capped at its target) and returns it updated.
    /// </summary>
    /// <example><code>(await logGoalProgress.ExecuteAsync("g1", ct)).Done; // 4</code></example>
    public async Task<Goal> ExecuteAsync(string goalId, CancellationToken cancellationToken)
    {
        var goal = await goals.FindAsync(goalId, cancellationToken)
            ?? throw ResourceNotFoundException.For("goal", goalId);
        goal.LogProgress();
        await goals.SaveProgressAsync(goal, cancellationToken);
        return goal;
    }
}
