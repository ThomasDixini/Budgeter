using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>
/// Turns completed routine blocks into goal progress. The block outcome is saved first and the credit
/// second; both writes are idempotent, so a retry repairs whichever one failed.
/// </summary>
public sealed class GoalCredits(IGoalRepository goals, IGoalProgressLedger ledger)
{
    /// <summary>
    /// Counts one completion for every frequency goal of the block's category. Doing it again for the
    /// same block on the same day changes nothing. A block without a category credits nothing.
    /// </summary>
    /// <example><code>await goalCredits.CreditBlockAsync("weekdays/csharp", "study", day, ct);</code></example>
    public async Task CreditBlockAsync(
        string blockRef, string? categoryId, DateOnly day, CancellationToken cancellationToken)
    {
        if (categoryId is null) return;
        foreach (var goal in await goals.ListAsync(day, cancellationToken))
        {
            if (!goal.AcceptsBlockOf(categoryId)) continue;
            var entryId = $"{goal.Id}:block:{blockRef}:{day:yyyy-MM-dd}";
            await ledger.RecordAsync(
                new GoalProgressEvent(entryId, goal.Id, day, 1, GoalSource.Block, blockRef), cancellationToken);
        }
    }

    /// <summary>
    /// Takes back what a block earned on a day, for when it is undone or skipped.
    /// </summary>
    /// <example><code>await goalCredits.RevokeBlockAsync("weekdays/csharp", day, ct);</code></example>
    public Task RevokeBlockAsync(string blockRef, DateOnly day, CancellationToken cancellationToken)
    {
        return ledger.RemoveBySourceAsync(GoalSource.Block, blockRef, day, cancellationToken);
    }
}
