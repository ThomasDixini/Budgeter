namespace Budgeter.Api.Domain.Goals;

/// <summary>Something to repeat (frequency) or reach (objective) within a period, with its progress.</summary>
public sealed class Goal
{
    public const int MaxTitleLength = 80;
    public const int MaxUnitLength = 24;
    public const int MaxTarget = 100_000;

    public GoalDefinition Definition { get; }

    /// <summary>Progress inside the current period, never above the target.</summary>
    public int Done { get; }

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
    /// Rebuilds a stored goal with the progress of its current period.
    /// </summary>
    /// <example><code>Goal.Restore(definition, done: 3).Done; // 3</code></example>
    public static Goal Restore(GoalDefinition definition, int done)
    {
        var normalized = GoalRules.Normalize(definition);
        return new Goal(normalized, Math.Clamp(done, 0, normalized.Target));
    }

    /// <summary>
    /// Whether a completed block or task of a category should count toward this goal: only a
    /// frequency goal of that category that is tracked from that kind of source.
    /// </summary>
    /// <example><code>goal.Accepts(GoalSource.Block, "study"); // true for a study goal tracked from blocks</code></example>
    public bool Accepts(GoalSource source, string categoryId)
    {
        var wanted = source switch
        {
            GoalSource.Block => GoalTracking.Blocks,
            GoalSource.Task => GoalTracking.Tasks,
            _ => GoalTracking.Manual,
        };
        return Definition.Type == GoalType.Frequency
            && Definition.Tracking == wanted
            && wanted != GoalTracking.Manual
            && CategoryId == categoryId;
    }
}
