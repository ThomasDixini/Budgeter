using Orbit.Api.Domain;
using Orbit.Api.Domain.Goals;

namespace Orbit.Api.Application.Goals;

public sealed record SetGoalAchievementCommand(string GoalId, DateOnly Day, bool IsAchieved);

/// <summary>
/// Marks an objective achieved on a day, or takes the mark back, for the period around that day only:
/// the next period starts pending. Marking it twice in a period keeps the first day; taking back a
/// mark that is not there succeeds, so retries are harmless.
/// </summary>
public sealed class SetGoalAchievement(IGoalRepository goals, IGoalProgressLedger ledger)
{
    /// <summary>
    /// Records or removes the achievement and returns the objective as it stands on the command's day.
    /// </summary>
    /// <example><code>await setGoalAchievement.ExecuteAsync(new("g2", day, IsAchieved: true), ct);</code></example>
    public async Task<Goal> ExecuteAsync(SetGoalAchievementCommand command, CancellationToken cancellationToken)
    {
        var goal = await goals.FindAsync(command.GoalId, command.Day, cancellationToken)
            ?? throw ResourceNotFoundException.For("goal", command.GoalId);
        RequireObjective(goal);
        var window = GoalWindow.For(goal.Definition.Period, command.Day, goal.Definition.Deadline);
        if (command.IsAchieved) await MarkAsync(goal, command.Day, window, cancellationToken);
        else await ledger.RemoveAchievementsAsync(goal.Id, window, cancellationToken);
        return await goals.FindAsync(goal.Id, command.Day, cancellationToken) ?? goal;
    }

    private Task MarkAsync(Goal goal, DateOnly day, GoalWindow window, CancellationToken cancellationToken)
    {
        var entryId = GoalAchievement.EntryId(goal.Id, window.Start);
        return ledger.RecordAsync(
            new GoalProgressEvent(entryId, goal.Id, day, 1, GoalSource.Manual, GoalAchievement.SourceRef),
            cancellationToken);
    }

    private static void RequireObjective(Goal goal)
    {
        if (goal.Definition.Type == GoalType.Objective) return;
        throw new DomainRuleException(
            $"Expected an objective to mark achieved (frequency goals count completed blocks), received {goal.Definition.Type} goal \"{goal.Id}\"");
    }
}
