using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Application.Routines;

/// <summary>Reads the routine rotation.</summary>
public sealed class GetRoutineRotation(IRoutineRotationRepository rotations)
{
    /// <summary>
    /// Returns the saved rotation, or an empty one before the first save.
    /// </summary>
    /// <example><code>var rotation = await getRoutineRotation.ExecuteAsync(ct);</code></example>
    public Task<RoutineRotation> ExecuteAsync(CancellationToken cancellationToken)
    {
        return rotations.GetAsync(cancellationToken);
    }
}
