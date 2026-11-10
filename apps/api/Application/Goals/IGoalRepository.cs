using Orbit.Api.Domain.Goals;

namespace Orbit.Api.Application.Goals;

/// <summary>Port to the storage of goals; progress is read for the period around a given day.</summary>
public interface IGoalRepository
{
    /// <summary>All goals in creation order, each with the progress of the period around <paramref name="day"/>.</summary>
    Task<IReadOnlyList<Goal>> ListAsync(DateOnly day, CancellationToken cancellationToken);

    /// <summary>The goal with this id and its progress around <paramref name="day"/>, or null when there is none.</summary>
    Task<Goal?> FindAsync(string id, DateOnly day, CancellationToken cancellationToken);

    /// <summary>
    /// Stores a new goal; false, storing nothing, when one with its id is already stored. Checked and
    /// written in one statement, so two retries arriving together cannot both insert.
    /// </summary>
    Task<bool> AddAsync(Goal goal, CancellationToken cancellationToken);

    /// <summary>Replaces the definition of a stored goal; its progress entries are kept.</summary>
    Task UpdateAsync(GoalDefinition definition, CancellationToken cancellationToken);

    /// <summary>Removes the goal and its progress entries; an unknown id is ignored.</summary>
    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
