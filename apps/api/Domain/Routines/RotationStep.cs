namespace Orbit.Api.Domain.Routines;

/// <summary>One stretch of the rotation: a routine followed for a number of weeks in a row.</summary>
public sealed class RotationStep
{
    public const int MaxWeeks = 12;

    public string RoutineId { get; }
    public int Weeks { get; }

    private RotationStep(string routineId, int weeks)
    {
        RoutineId = routineId;
        Weeks = weeks;
    }

    /// <summary>
    /// Builds a valid step: a routine id and 1 to 12 weeks.
    /// </summary>
    /// <example><code>RotationStep.Create("normal", 2).Weeks; // 2</code></example>
    public static RotationStep Create(string routineId, int weeks)
    {
        if (weeks is < 1 or > MaxWeeks)
        {
            throw new DomainRuleException(
                $"Expected a rotation step to last from 1 to {MaxWeeks} weeks, received {weeks}");
        }
        return new RotationStep(EntityId.Require(routineId, "rotation step routine id"), weeks);
    }

    /// <summary>
    /// Rebuilds a stored step as it was saved, without today's rules.
    /// </summary>
    /// <example><code>RotationStep.Restore("normal", 2);</code></example>
    internal static RotationStep Restore(string routineId, int weeks) => new(routineId, weeks);
}
