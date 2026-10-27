using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>Port to the storage of goals and their progress.</summary>
public interface IGoalRepository
{
    /// <summary>All goals in creation order.</summary>
    Task<IReadOnlyList<Goal>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The goal with this id, or null when there is none.</summary>
    Task<Goal?> FindAsync(string id, CancellationToken cancellationToken);

    /// <summary>Stores a new goal.</summary>
    Task AddAsync(Goal goal, CancellationToken cancellationToken);

    /// <summary>Persists the current progress of an existing goal.</summary>
    Task SaveProgressAsync(Goal goal, CancellationToken cancellationToken);
}
