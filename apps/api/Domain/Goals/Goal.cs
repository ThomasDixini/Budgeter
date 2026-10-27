namespace Budgeter.Api.Domain.Goals;

/// <summary>Something to repeat (frequency) or reach (objective) within a period, with its progress.</summary>
public sealed class Goal
{
    public const int MaxTitleLength = 80;
    public const int MaxUnitLength = 24;
    public const int MaxTarget = 100_000;

    public GoalDefinition Definition { get; }
    public int Done { get; private set; }

    public string Id => Definition.Id;
    public string CategoryId => Definition.CategoryId;

    private Goal(GoalDefinition definition, int done)
    {
        Definition = definition;
        Done = done;
    }

    /// <summary>
    /// Validates a new goal and starts it with no progress.
    /// </summary>
    /// <example><code>Goal.Create(new GoalDefinition("g1", "study", "Study C#", GoalType.Frequency, GoalPeriod.Weekly, 5, null, null)).Done; // 0</code></example>
    public static Goal Create(GoalDefinition definition)
    {
        return new Goal(GoalRules.Normalize(definition), 0);
    }

    /// <summary>
    /// Rebuilds a stored goal with its recorded progress.
    /// </summary>
    /// <example><code>Goal.Restore(definition, done: 3).Done; // 3</code></example>
    public static Goal Restore(GoalDefinition definition, int done)
    {
        var goal = Create(definition);
        goal.Done = Math.Clamp(done, 0, goal.Definition.Target);
        return goal;
    }

    /// <summary>
    /// Logs one more repetition or unit of progress, stopping at the target.
    /// </summary>
    /// <example><code>goal.LogProgress(); // Done goes from 3 to 4</code></example>
    public void LogProgress()
    {
        Done = Math.Min(Definition.Target, Done + 1);
    }
}
