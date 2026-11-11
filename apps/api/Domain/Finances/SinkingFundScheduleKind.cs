namespace Orbit.Api.Domain.Finances;

/// <summary>How a sinking fund's due dates repeat.</summary>
public enum SinkingFundScheduleKind
{
    /// <summary>Every few months, counted from the first due date.</summary>
    EveryMonths,

    /// <summary>Once a year on the same month and day.</summary>
    FixedDate,
}
