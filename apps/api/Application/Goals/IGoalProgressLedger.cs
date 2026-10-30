using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>
/// Port to the log of goal progress. Entries are never edited and every write is idempotent (an entry
/// id counts once, removing what is not there does nothing), so a retried request repairs a
/// half-finished one. The log is what keeps past periods: nothing is reset, a new period just has no
/// entries yet.
/// </summary>
public interface IGoalProgressLedger
{
    /// <summary>Adds the entry unless one with the same id is already logged.</summary>
    Task RecordAsync(GoalProgressEvent entry, CancellationToken cancellationToken);

    /// <summary>Removes the entry with this id, if there is one.</summary>
    Task RemoveAsync(string eventId, CancellationToken cancellationToken);

    /// <summary>Removes the entries a block produced on a day, from every goal.</summary>
    Task RemoveBySourceAsync(GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken);
}
