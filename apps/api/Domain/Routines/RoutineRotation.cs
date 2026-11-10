namespace Orbit.Api.Domain.Routines;

/// <summary>
/// Which routine is followed week by week, as a cycle that repeats: e.g. "Normal" for two weeks,
/// "Intense" for one, "Light" for one, then "Normal" again. The cycle's first week starts on
/// <see cref="StartsOn"/>, always a Monday. Routines outside the rotation apply every week; one inside
/// it applies only in its own weeks. A rotation with no steps is turned off.
/// </summary>
public sealed class RoutineRotation
{
    public const int MaxSteps = 12;
    private const int DaysPerWeek = 7;

    public DateOnly StartsOn { get; }
    public IReadOnlyList<RotationStep> Steps { get; }

    /// <summary>Ids of the routines the rotation alternates, without repeats.</summary>
    public IEnumerable<string> RoutineIds => Steps.Select(step => step.RoutineId).Distinct();

    private RoutineRotation(DateOnly startsOn, IReadOnlyList<RotationStep> steps)
    {
        StartsOn = startsOn;
        Steps = steps;
    }

    /// <summary>The rotation before anything was saved: no steps, so every routine applies every week.</summary>
    public static RoutineRotation Empty { get; } = new(DateOnly.MinValue, []);

    /// <summary>
    /// Builds a valid rotation: at most 12 steps, starting on the Monday of the week of
    /// <paramref name="startsOn"/> (any day of that week is accepted).
    /// </summary>
    /// <example><code>RoutineRotation.Create(new DateOnly(2026, 11, 4), [RotationStep.Create("normal", 2)]).StartsOn; // 2026-11-02</code></example>
    public static RoutineRotation Create(DateOnly startsOn, IReadOnlyList<RotationStep> steps)
    {
        if (steps.Count > MaxSteps)
        {
            throw new DomainRuleException($"Expected at most {MaxSteps} rotation steps, received {steps.Count}");
        }
        return new RoutineRotation(MondayOf(startsOn), steps);
    }

    /// <summary>
    /// Rebuilds a stored rotation as it was saved, without today's rules.
    /// </summary>
    /// <example><code>RoutineRotation.Restore(new DateOnly(2026, 11, 2), storedSteps);</code></example>
    internal static RoutineRotation Restore(DateOnly startsOn, IReadOnlyList<RotationStep> steps) => new(startsOn, steps);

    // DayOfWeek counts from Sunday = 0; the app's weeks start on Monday.
    private static DateOnly MondayOf(DateOnly day) =>
        day.AddDays(-(((int)day.DayOfWeek + DaysPerWeek - 1) % DaysPerWeek));
}
