using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Routines;

/// <summary>
/// Puts a block completed or skipped by mistake back as planned for that day, and takes back the goal
/// progress it earned. Undoing one that is not recorded succeeds, so a retried request is harmless.
/// </summary>
public sealed class UndoBlockOutcome(IBlockOutcomeRepository outcomes, GoalCredits goalCredits)
{
    /// <summary>
    /// Validates the ids and removes the outcome and its goal progress if there are any.
    /// </summary>
    /// <example><code>await undoBlockOutcome.ExecuteAsync("weekdays", "project", new DateOnly(2026, 10, 27), ct);</code></example>
    public async Task ExecuteAsync(string routineId, string blockId, DateOnly date, CancellationToken cancellationToken)
    {
        var validRoutineId = EntityId.Require(routineId, "routine id");
        var validBlockId = EntityId.Require(blockId, "block id");
        await outcomes.DeleteAsync(validRoutineId, validBlockId, date, cancellationToken);
        await goalCredits.RevokeAsync(
            GoalSource.Block, BlockSourceRef.For(validRoutineId, validBlockId), date, cancellationToken);
    }
}
