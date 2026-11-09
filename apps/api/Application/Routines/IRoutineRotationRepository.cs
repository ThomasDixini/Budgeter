using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Application.Routines;

/// <summary>Port to the storage of the routine rotation (there is one).</summary>
public interface IRoutineRotationRepository
{
    /// <summary>The saved rotation, or <see cref="RoutineRotation.Empty"/> when none was saved yet.</summary>
    Task<RoutineRotation> GetAsync(CancellationToken cancellationToken);

    /// <summary>Replaces the saved rotation, steps included, as one change.</summary>
    Task ReplaceAsync(RoutineRotation rotation, CancellationToken cancellationToken);
}
