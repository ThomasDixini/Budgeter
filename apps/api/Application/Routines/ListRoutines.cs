using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

/// <summary>Lists every routine in creation order.</summary>
public sealed class ListRoutines(IRoutineRepository routines)
{
    /// <summary>
    /// Returns all routines with their blocks.
    /// </summary>
    /// <example><code>var all = await listRoutines.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<Routine>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return routines.ListAsync(cancellationToken);
    }
}
