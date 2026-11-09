using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Application.Routines;

/// <summary>Port to the storage of routines and their blocks.</summary>
public interface IRoutineRepository
{
    /// <summary>All routines in creation order, each with its blocks in the order they were saved.</summary>
    Task<IReadOnlyList<Routine>> ListAsync(CancellationToken cancellationToken);

    /// <summary>The routine with this id and its blocks, or null when there is none.</summary>
    Task<Routine?> FindAsync(string routineId, CancellationToken cancellationToken);

    /// <summary>Stores the routine, replacing every field and block of a stored one with the same id.</summary>
    Task SaveAsync(Routine routine, CancellationToken cancellationToken);

    /// <summary>Removes the routine, its blocks and its rotation steps; an unknown id is ignored.</summary>
    Task DeleteAsync(string routineId, CancellationToken cancellationToken);
}
