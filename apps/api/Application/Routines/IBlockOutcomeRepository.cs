using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

/// <summary>Port to the storage of blocks completed or skipped per day.</summary>
public interface IBlockOutcomeRepository
{
    /// <summary>Outcomes recorded on a day, in the order they were recorded.</summary>
    Task<IReadOnlyList<BlockOutcome>> ListAsync(DateOnly date, CancellationToken cancellationToken);

    /// <summary>Stores the outcome, replacing one recorded for the same block on the same day.</summary>
    Task SaveAsync(BlockOutcome outcome, CancellationToken cancellationToken);
}
