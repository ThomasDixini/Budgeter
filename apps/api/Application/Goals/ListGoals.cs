using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>Lists every goal with the progress of its current period, in creation order.</summary>
public sealed class ListGoals(IGoalRepository goals)
{
    /// <summary>
    /// Returns all goals, their period being the one around <paramref name="day"/> (the client's today).
    /// </summary>
    /// <example><code>var all = await listGoals.ExecuteAsync(new DateOnly(2026, 10, 28), ct);</code></example>
    public Task<IReadOnlyList<Goal>> ExecuteAsync(DateOnly day, CancellationToken cancellationToken)
    {
        return goals.ListAsync(day, cancellationToken);
    }
}
