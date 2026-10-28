using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

public sealed record UpdateGoalCommand(
    string Id,
    string Title,
    GoalPeriod Period,
    int Target,
    string? Unit,
    DateOnly? Deadline,
    GoalTracking Tracking,
    DateOnly Day);

/// <summary>Edits a goal. Its type and category stay as they were; its progress entries are kept.</summary>
public sealed class UpdateGoal(IGoalRepository goals, IGoalProgressLedger ledger)
{
    /// <summary>
    /// Validates the new definition, stores it and returns the goal with its progress around the command's day.
    /// Changing what feeds the goal drops the block and task entries it had earned, so the old source stops counting.
    /// </summary>
    /// <example><code>await updateGoal.ExecuteAsync(new("g1", "Study C# 4x a week", GoalPeriod.Weekly, 4, null, null, GoalTracking.Blocks, day), ct);</code></example>
    public async Task<Goal> ExecuteAsync(UpdateGoalCommand command, CancellationToken cancellationToken)
    {
        var current = await goals.FindAsync(command.Id, command.Day, cancellationToken)
            ?? throw ResourceNotFoundException.For("goal", command.Id);
        var edited = Goal.Create(current.Definition with
        {
            Title = command.Title,
            Period = command.Period,
            Target = command.Target,
            Unit = command.Unit,
            Deadline = command.Deadline,
            Tracking = command.Tracking,
        });
        await goals.UpdateAsync(edited.Definition, cancellationToken);
        if (edited.Definition.Tracking != current.Definition.Tracking)
        {
            await ledger.RemoveAutomaticAsync(edited.Id, cancellationToken);
        }
        return await goals.FindAsync(edited.Id, command.Day, cancellationToken) ?? edited;
    }
}
