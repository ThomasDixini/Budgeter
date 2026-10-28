using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

public sealed record LogGoalProgressCommand(string GoalId, string EventId, DateOnly Day, int Amount);

/// <summary>
/// Logs progress by hand on a goal: one more repetition or unit, or a take-back of one. Repeating a
/// request with the same entry id counts once.
/// </summary>
public sealed class LogGoalProgress(IGoalRepository goals, IGoalProgressLedger ledger)
{
    /// <summary>
    /// Logs the entry and returns the goal with its updated progress. A take-back that would go below
    /// zero manual progress is ignored.
    /// </summary>
    /// <example><code>await logGoalProgress.ExecuteAsync(new("g1", Guid.NewGuid().ToString(), day, Amount: 1), ct);</code></example>
    public async Task<Goal> ExecuteAsync(LogGoalProgressCommand command, CancellationToken cancellationToken)
    {
        var goal = await goals.FindAsync(command.GoalId, command.Day, cancellationToken)
            ?? throw ResourceNotFoundException.For("goal", command.GoalId);
        RequireAmount(command.Amount);
        var entry = new GoalProgressEvent(
            EntityId.Require(command.EventId, "progress entry id"), goal.Id, command.Day, command.Amount,
            GoalSource.Manual, string.Empty);
        await RecordAsync(goal, entry, cancellationToken);
        return await goals.FindAsync(goal.Id, command.Day, cancellationToken) ?? goal;
    }

    /// <summary>A repetition past the target is ignored, so every entry stored is one the card can show and take back.</summary>
    private async Task RecordAsync(Goal goal, GoalProgressEvent entry, CancellationToken cancellationToken)
    {
        if (entry.Amount < 0)
        {
            var window = GoalWindow.For(goal.Definition.Period, entry.Date, goal.Definition.Deadline);
            await ledger.TakeBackAsync(entry, window, cancellationToken);
            return;
        }
        if (goal.Done >= goal.Definition.Target) return;
        await ledger.RecordAsync(entry, cancellationToken);
    }

    private static void RequireAmount(int amount)
    {
        if (amount == 0 || Math.Abs(amount) > Goal.MaxTarget)
        {
            throw new DomainRuleException(
                $"Expected the progress amount to be a non-zero whole number up to {Goal.MaxTarget} either way, received {amount}");
        }
    }
}
