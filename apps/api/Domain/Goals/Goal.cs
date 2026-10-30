namespace Budgeter.Api.Domain.Goals;

/// <summary>Something to repeat (frequency) or reach (objective) within a period, with its progress.</summary>
public sealed class Goal
{
    public const int MaxTitleLength = 80;
    public const int MaxUnitLength = 24;
    public const int MaxTarget = 100_000;

    public GoalDefinition Definition { get; }

    /// <summary>
    /// Progress inside the period: completed blocks for a frequency goal (it may go past the target),
    /// the target itself for an achieved objective and zero for one not achieved yet.
    /// </summary>
    public int Done { get; }

    /// <summary>The day an objective was marked achieved; null for frequency goals and pending objectives.</summary>
    public DateOnly? AchievedOn { get; }

    public string Id => Definition.Id;
    public string CategoryId => Definition.CategoryId;

    private Goal(GoalDefinition definition, int done, DateOnly? achievedOn)
    {
        Definition = definition;
        Done = done;
        AchievedOn = achievedOn;
    }

    /// <summary>
    /// Validates a new goal and starts it with no progress.
    /// </summary>
    /// <example><code>Goal.Create(new GoalDefinition("g1", "study", "Study C#", GoalType.Frequency, GoalPeriod.Weekly, 5, null, null)).Done; // 0</code></example>
    public static Goal Create(GoalDefinition definition)
    {
        return new Goal(GoalRules.Normalize(definition), 0, null);
    }

    /// <summary>
    /// Rebuilds a stored frequency goal with the blocks completed in its period.
    /// </summary>
    /// <example><code>Goal.Restore(definition, done: 7).Done; // 7, even with a target of 5</code></example>
    public static Goal Restore(GoalDefinition definition, int done)
    {
        return new Goal(GoalRules.Normalize(definition), Math.Max(0, done), null);
    }

    /// <summary>
    /// Rebuilds a stored objective, achieved on <paramref name="achievedOn"/> or still pending when null.
    /// </summary>
    /// <example><code>Goal.RestoreObjective(definition, new DateOnly(2026, 10, 28)).Done; // the target</code></example>
    public static Goal RestoreObjective(GoalDefinition definition, DateOnly? achievedOn)
    {
        var normalized = GoalRules.Normalize(definition);
        return new Goal(normalized, achievedOn is null ? 0 : normalized.Target, achievedOn);
    }

    /// <summary>
    /// Whether a completed routine block of a category counts toward this goal: only a frequency goal
    /// of that category.
    /// </summary>
    /// <example><code>goal.AcceptsBlockOf("study"); // true for a study frequency goal</code></example>
    public bool AcceptsBlockOf(string categoryId)
    {
        return Definition.Type == GoalType.Frequency && CategoryId == categoryId;
    }
}
