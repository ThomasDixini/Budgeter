using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

public sealed record RecordBlockOutcomeCommand(
    string RoutineId, string BlockId, DateOnly Date, BlockOutcomeKind Kind, string At);

/// <summary>
/// Records that a block was completed or skipped on a day; recording it again replaces the
/// previous outcome, so a retried request is harmless.
/// </summary>
public sealed class RecordBlockOutcome(IBlockOutcomeRepository outcomes, IRoutineRepository routines)
{
    /// <summary>
    /// Validates the outcome, checks the routine has the block and stores it.
    /// </summary>
    /// <example><code>await recordBlockOutcome.ExecuteAsync(new("weekdays", "project", day, BlockOutcomeKind.Done, "20:40"), ct);</code></example>
    public async Task<BlockOutcome> ExecuteAsync(RecordBlockOutcomeCommand command, CancellationToken cancellationToken)
    {
        var outcome = BlockOutcome.Create(command.RoutineId, command.BlockId, command.Date, command.Kind, command.At);
        await RequireBlockAsync(outcome, cancellationToken);
        await outcomes.SaveAsync(outcome, cancellationToken);
        return outcome;
    }

    private async Task RequireBlockAsync(BlockOutcome outcome, CancellationToken cancellationToken)
    {
        var routine = (await routines.ListAsync(cancellationToken)).FirstOrDefault(stored => stored.Id == outcome.RoutineId)
            ?? throw ResourceNotFoundException.For("routine", outcome.RoutineId);
        if (routine.Blocks.All(block => block.Id != outcome.BlockId))
        {
            throw ResourceNotFoundException.For($"block of routine \"{routine.Id}\"", outcome.BlockId);
        }
    }
}
