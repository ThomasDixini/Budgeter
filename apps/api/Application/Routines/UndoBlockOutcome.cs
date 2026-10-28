using Budgeter.Api.Domain;

namespace Budgeter.Api.Application.Routines;

/// <summary>
/// Puts a block completed or skipped by mistake back as planned for that day. Undoing one that
/// is not recorded succeeds, so a retried request is harmless.
/// </summary>
public sealed class UndoBlockOutcome(IBlockOutcomeRepository outcomes)
{
    /// <summary>
    /// Validates the ids and removes the outcome if there is one.
    /// </summary>
    /// <example><code>await undoBlockOutcome.ExecuteAsync("weekdays", "project", new DateOnly(2026, 10, 27), ct);</code></example>
    public Task ExecuteAsync(string routineId, string blockId, DateOnly date, CancellationToken cancellationToken)
    {
        return outcomes.DeleteAsync(
            EntityId.Require(routineId, "routine id"), EntityId.Require(blockId, "block id"), date, cancellationToken);
    }
}
