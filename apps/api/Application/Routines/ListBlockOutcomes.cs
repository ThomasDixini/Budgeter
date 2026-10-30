using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Application.Routines;

/// <summary>Lists the blocks completed or skipped on a day.</summary>
public sealed class ListBlockOutcomes(IBlockOutcomeRepository outcomes)
{
    /// <summary>
    /// Returns the day's outcomes in the order they were recorded.
    /// </summary>
    /// <example><code>var today = await listBlockOutcomes.ExecuteAsync(new DateOnly(2026, 10, 27), ct);</code></example>
    public Task<IReadOnlyList<BlockOutcome>> ExecuteAsync(DateOnly date, CancellationToken cancellationToken)
    {
        return outcomes.ListAsync(date, cancellationToken);
    }
}
