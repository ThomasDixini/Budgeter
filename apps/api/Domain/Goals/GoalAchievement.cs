using System.Globalization;

namespace Orbit.Api.Domain.Goals;

/// <summary>
/// How an objective is marked achieved in the progress log. A mark belongs to one period of the
/// objective, so a weekly objective starts pending again every Monday and can be achieved again.
/// </summary>
public static class GoalAchievement
{
    /// <summary>Source reference of the entries that mark an objective achieved.</summary>
    public const string SourceRef = "achievement";

    /// <summary>
    /// Id of the entry that marks an objective achieved in the period starting on
    /// <paramref name="periodStart"/>; marking it again in that period counts once. Marks logged before
    /// periods applied to objectives were named <c>{goalId}:achievement</c> and still read as marks.
    /// </summary>
    /// <example><code>GoalAchievement.EntryId("g2", new DateOnly(2026, 10, 26)); // "g2:achievement:2026-10-26"</code></example>
    public static string EntryId(string goalId, DateOnly periodStart) =>
        $"{goalId}:{SourceRef}:{periodStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}";
}
