namespace Budgeter.Api.Domain.Goals;

/// <summary>Business rules a goal definition must satisfy.</summary>
internal static class GoalRules
{
    /// <summary>
    /// Returns the definition with trimmed text, or throws naming the first broken rule.
    /// </summary>
    /// <example><code>GoalRules.Normalize(definition with { Title = " Read " }).Title; // "Read"</code></example>
    public static GoalDefinition Normalize(GoalDefinition definition)
    {
        RequireTarget(definition.Target);
        return definition with
        {
            Tracking = TrackingFor(definition.Type),
            Id = EntityId.Require(definition.Id, "goal id"),
            CategoryId = EntityId.Require(definition.CategoryId, "category id"),
            Title = RequiredText.Require(definition.Title, Goal.MaxTitleLength, "goal title"),
            Unit = NormalizeUnit(definition.Type, definition.Unit),
            Deadline = RequireDeadlineMatchesPeriod(definition.Period, definition.Deadline),
        };
    }

    private static void RequireTarget(int target)
    {
        if (target < 1 || target > Goal.MaxTarget)
        {
            throw new DomainRuleException(
                $"Expected the goal target to be between 1 and {Goal.MaxTarget}, received {target}");
        }
    }

    // Frequency goals count completed blocks; objectives are marked achieved by hand.
    private static GoalTracking TrackingFor(GoalType type) =>
        type == GoalType.Frequency ? GoalTracking.Blocks : GoalTracking.Manual;

    private static string? NormalizeUnit(GoalType type, string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit)) return null;
        if (type != GoalType.Objective)
        {
            throw new DomainRuleException(
                $"Expected no unit on a {type} goal (units belong to objectives), received \"{unit}\"");
        }
        return RequiredText.Require(unit, Goal.MaxUnitLength, "goal unit");
    }

    private static DateOnly? RequireDeadlineMatchesPeriod(GoalPeriod period, DateOnly? deadline)
    {
        var isCustom = period == GoalPeriod.Custom;
        if (isCustom && deadline is null)
        {
            throw new DomainRuleException("Expected a deadline (YYYY-MM-DD) for a custom period, received none");
        }
        if (!isCustom && deadline is not null)
        {
            throw new DomainRuleException(
                $"Expected no deadline on a {period} goal (only custom periods end on a date), received {deadline:yyyy-MM-dd}");
        }
        return deadline;
    }
}
