namespace Budgeter.Api.Domain.Routines;

/// <summary>How a routine block ended on a given day.</summary>
public enum BlockOutcomeKind
{
    Done,
    Skipped,
}

/// <summary>
/// A routine block completed or skipped on one day, and the time it ended. The day's later blocks
/// move earlier by the time saved; the routine itself never changes.
/// </summary>
public sealed class BlockOutcome
{
    public string RoutineId { get; }
    public string BlockId { get; }
    public DateOnly Date { get; }
    public BlockOutcomeKind Kind { get; }

    /// <summary>When the block ended, shaped like <c>HH:mm</c>.</summary>
    public string At { get; }

    private BlockOutcome(string routineId, string blockId, DateOnly date, BlockOutcomeKind kind, string at)
    {
        RoutineId = routineId;
        BlockId = blockId;
        Date = date;
        Kind = kind;
        At = at;
    }

    /// <summary>
    /// Builds a valid outcome.
    /// </summary>
    /// <example><code>BlockOutcome.Create("weekdays", "project", new DateOnly(2026, 10, 27), BlockOutcomeKind.Done, "20:40");</code></example>
    public static BlockOutcome Create(string routineId, string blockId, DateOnly date, BlockOutcomeKind kind, string at)
    {
        return new BlockOutcome(
            EntityId.Require(routineId, "routine id"),
            EntityId.Require(blockId, "block id"),
            date,
            kind,
            ClockTime.Require(at, "block end time"));
    }
}
