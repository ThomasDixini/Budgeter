namespace Orbit.Api.Domain.Goals;

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

    /// <summary>
    /// The day an objective was marked achieved in its current period; null for frequency goals and
    /// pending objectives.
    /// </summary>
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
    /// Rebuilds a stored frequency goal with the blocks completed in its period. The definition is read as
    /// it was saved, without today's rules, so a stricter rule never makes an old goal unreadable.
    /// </summary>
    /// <example><code>Goal.Restore(definition, done: 7).Done; // 7, even with a target of 5</code></example>
    public static Goal Restore(GoalDefinition definition, int done)
    {
        return new Goal(GoalRules.WithDerivedTracking(definition), Math.Max(0, done), null);
    }

    /// <summary>
    /// Rebuilds a stored objective, achieved on <paramref name="achievedOn"/> or still pending when null,
    /// reading its definition as it was saved.
    /// </summary>
    /// <example><code>Goal.RestoreObjective(definition, new DateOnly(2026, 10, 28)).Done; // the target</code></example>
    public static Goal RestoreObjective(GoalDefinition definition, DateOnly? achievedOn)
    {
        var restored = GoalRules.WithDerivedTracking(definition);
        return new Goal(restored, achievedOn is null ? 0 : restored.Target, achievedOn);
    }

    /// <summary>
    /// Rebuilds a stored goal as it stands on a day from its progress log. A frequency goal sums the
    /// entries of its period around the day (manual ones kept from before goals counted blocks never
    /// below zero); an objective is achieved once marked in that period, as of the day it was marked.
    /// Entries of other goals are ignored, so the whole log can be handed over.
    /// </summary>
    /// <example><code>Goal.StandingOn(definition, entries, new DateOnly(2026, 10, 28)).Done; // 3</code></example>
    public static Goal StandingOn(GoalDefinition definition, IEnumerable<GoalProgressEvent> entries, DateOnly day)
    {
        var window = GoalWindow.For(definition.Period, day, definition.Deadline);
        var own = entries.Where(entry => entry.GoalId == definition.Id).ToList();
        return definition.Type == GoalType.Objective
            ? RestoreObjective(definition, FirstMarkIn(own, window, day))
            : Restore(definition, CompletedIn(own, window));
    }

    private static DateOnly? FirstMarkIn(IEnumerable<GoalProgressEvent> entries, GoalWindow window, DateOnly day) =>
        entries
            .Where(entry => entry.SourceRef == GoalAchievement.SourceRef && entry.Date >= window.Start && entry.Date <= day)
            .Select(entry => (DateOnly?)entry.Date)
            .Min();

    private static int CompletedIn(IEnumerable<GoalProgressEvent> entries, GoalWindow window)
    {
        var inWindow = entries
            .Where(entry => entry.SourceRef != GoalAchievement.SourceRef && window.Contains(entry.Date))
            .ToList();
        var manual = inWindow.Where(entry => entry.Source == GoalSource.Manual).Sum(entry => entry.Amount);
        var automatic = inWindow.Where(entry => entry.Source != GoalSource.Manual).Sum(entry => entry.Amount);
        return GoalProgress.Compute(manual, automatic);
    }

    /// <summary>
    /// Whether the other goal was set with the same definition, as a retried create must be.
    /// </summary>
    /// <example><code>stored.HasSameDefinitionAs(Goal.Create(definition)); // true</code></example>
    public bool HasSameDefinitionAs(Goal other) => Definition == other.Definition;

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
