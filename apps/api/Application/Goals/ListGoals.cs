using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>Lists every goal with its progress, in creation order.</summary>
public sealed class ListGoals(IGoalRepository goals)
{
    /// <summary>
    /// Returns all goals.
    /// </summary>
    /// <example><code>var all = await listGoals.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<Goal>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return goals.ListAsync(cancellationToken);
    }
}
