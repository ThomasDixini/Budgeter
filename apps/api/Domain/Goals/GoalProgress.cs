namespace Budgeter.Api.Domain.Goals;

/// <summary>How the entries of a goal's current period add up.</summary>
public static class GoalProgress
{
    /// <summary>
    /// Progress shown for a goal: the manual entries (never below zero, however many were taken back)
    /// plus the automatic ones, capped at the target. The cap is applied only when reading, so the
    /// order in which entries arrive never costs the user credit.
    /// </summary>
    /// <example><code>GoalProgress.Compute(target: 5, manualTotal: -1, automaticTotal: 2); // 2</code></example>
    public static int Compute(int target, int manualTotal, int automaticTotal)
    {
        return Math.Clamp(Math.Max(0, manualTotal) + automaticTotal, 0, target);
    }
}
