using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Routines;

/// <summary>
/// Deletes a routine with its blocks. Deleting one that is already gone succeeds, so a retried
/// request (e.g. replayed from an offline queue) is harmless.
/// </summary>
public sealed class DeleteRoutine(IRoutineRepository routines)
{
    /// <summary>
    /// Validates the id and removes the routine if it exists.
    /// </summary>
    /// <example><code>await deleteRoutine.ExecuteAsync("weekend", ct);</code></example>
    public Task ExecuteAsync(string routineId, CancellationToken cancellationToken)
    {
        return routines.DeleteAsync(EntityId.Require(routineId, "routine id"), cancellationToken);
    }
}
