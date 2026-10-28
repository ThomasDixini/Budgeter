using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>
/// Turns completed routine blocks and tasks into goal progress. The block or task is saved first and
/// the credit second; both writes are idempotent, so a retry repairs whichever one failed.
/// </summary>
public sealed class GoalCredits(IGoalRepository goals, IGoalProgressLedger ledger)
{
    /// <summary>
    /// Counts one completion for every goal that is tracked from this kind of source in the category.
    /// Doing it again for the same completion changes nothing. A completion without a category credits nothing.
    /// </summary>
    /// <example><code>await goalCredits.CreditAsync(GoalSource.Block, "weekdays/csharp", "study", day, ct);</code></example>
    public async Task CreditAsync(
        GoalSource source, string sourceRef, string? categoryId, DateOnly day, CancellationToken cancellationToken)
    {
        if (categoryId is null) return;
        foreach (var goal in await goals.ListAsync(day, cancellationToken))
        {
            if (!goal.Accepts(source, categoryId)) continue;
            var entryId = $"{goal.Id}:{source.ToString().ToLowerInvariant()}:{sourceRef}:{day:yyyy-MM-dd}";
            await ledger.RecordAsync(new GoalProgressEvent(entryId, goal.Id, day, 1, source, sourceRef), cancellationToken);
        }
    }

    /// <summary>
    /// Takes back what a completion earned, for when it is undone, skipped or unchecked.
    /// </summary>
    /// <example><code>await goalCredits.RevokeAsync(GoalSource.Task, "t1", day, ct);</code></example>
    public Task RevokeAsync(GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken)
    {
        return ledger.RemoveBySourceAsync(source, sourceRef, day, cancellationToken);
    }
}
