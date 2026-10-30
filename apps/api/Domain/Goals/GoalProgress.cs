namespace Budgeter.Api.Domain.Goals;

/// <summary>How the entries of a goal's current period add up.</summary>
public static class GoalProgress
{
    /// <summary>
    /// Progress shown for a frequency goal: the manual entries left from before goals were fed by blocks
    /// (never below zero, however many were taken back) plus the automatic ones. It is not capped at
    /// the target: doing more than the goal asks is recorded as more.
    /// </summary>
    /// <example><code>GoalProgress.Compute(manualTotal: -1, automaticTotal: 7); // 7</code></example>
    public static int Compute(int manualTotal, int automaticTotal)
    {
        return Math.Max(0, manualTotal) + automaticTotal;
    }
}
