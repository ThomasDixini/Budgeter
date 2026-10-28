using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

public sealed record RecordBlockOutcomeCommand(
    string RoutineId, string BlockId, DateOnly Date, BlockOutcomeKind Kind, string At);

/// <summary>
/// Records that a block was completed or skipped on a day; recording it again replaces the
/// previous outcome, so a retried request is harmless. Completing a block counts toward the goals
/// of its category that are tracked from blocks; skipping it takes that back.
/// </summary>
public sealed class RecordBlockOutcome(
    IBlockOutcomeRepository outcomes, IRoutineRepository routines, GoalCredits goalCredits)
{
    /// <summary>
    /// Validates the outcome, checks the routine has the block, stores it and updates the goals.
    /// </summary>
    /// <example><code>await recordBlockOutcome.ExecuteAsync(new("weekdays", "project", day, BlockOutcomeKind.Done, "20:40"), ct);</code></example>
    public async Task<BlockOutcome> ExecuteAsync(RecordBlockOutcomeCommand command, CancellationToken cancellationToken)
    {
        var outcome = BlockOutcome.Create(command.RoutineId, command.BlockId, command.Date, command.Kind, command.At);
        var block = await RequireBlockAsync(outcome, cancellationToken);
        await outcomes.SaveAsync(outcome, cancellationToken);
        await UpdateGoalsAsync(outcome, block, cancellationToken);
        return outcome;
    }

    private async Task UpdateGoalsAsync(BlockOutcome outcome, RoutineBlock block, CancellationToken cancellationToken)
    {
        var sourceRef = BlockSourceRef.For(outcome.RoutineId, outcome.BlockId);
        if (outcome.Kind == BlockOutcomeKind.Done)
        {
            await goalCredits.CreditAsync(GoalSource.Block, sourceRef, block.CategoryId, outcome.Date, cancellationToken);
            return;
        }
        await goalCredits.RevokeAsync(GoalSource.Block, sourceRef, outcome.Date, cancellationToken);
    }

    private async Task<RoutineBlock> RequireBlockAsync(BlockOutcome outcome, CancellationToken cancellationToken)
    {
        var routine = (await routines.ListAsync(cancellationToken)).FirstOrDefault(stored => stored.Id == outcome.RoutineId)
            ?? throw ResourceNotFoundException.For("routine", outcome.RoutineId);
        return routine.Blocks.FirstOrDefault(block => block.Id == outcome.BlockId)
            ?? throw ResourceNotFoundException.For($"block of routine \"{routine.Id}\"", outcome.BlockId);
    }
}

/// <summary>How a routine block is named in the goal progress log.</summary>
internal static class BlockSourceRef
{
    /// <summary>
    /// The reference stored with the progress a block earned.
    /// </summary>
    /// <example><code>BlockSourceRef.For("weekdays", "csharp"); // "weekdays/csharp"</code></example>
    public static string For(string routineId, string blockId) => $"{routineId}/{blockId}";
}
