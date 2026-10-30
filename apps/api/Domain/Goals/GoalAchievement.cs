namespace Budgeter.Api.Domain.Goals;

/// <summary>How an objective is marked achieved in the progress log.</summary>
public static class GoalAchievement
{
    /// <summary>Source reference of the entry that marks an objective achieved.</summary>
    public const string SourceRef = "achievement";

    /// <summary>
    /// Id of the one entry that marks an objective achieved; marking it again counts once.
    /// </summary>
    /// <example><code>GoalAchievement.EntryId("g2"); // "g2:achievement"</code></example>
    public static string EntryId(string goalId) => $"{goalId}:{SourceRef}";
}
