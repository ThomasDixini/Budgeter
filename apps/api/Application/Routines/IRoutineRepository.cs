using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

/// <summary>Port to the storage of routines and their blocks.</summary>
public interface IRoutineRepository
{
    /// <summary>All routines in creation order, each with its blocks in the order they were saved.</summary>
    Task<IReadOnlyList<Routine>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Stores the routine, replacing every field and block of a stored one with the same id.</summary>
    Task SaveAsync(Routine routine, CancellationToken cancellationToken);

    /// <summary>Removes the routine and its blocks; an unknown id is ignored.</summary>
    Task DeleteAsync(string routineId, CancellationToken cancellationToken);
}
