namespace Budgeter.Api.Domain.Routines;

/// <summary>A day template (e.g. weekdays) with its hours and the blocks the day is split into.</summary>
public sealed class Routine
{
    public const int MaxNameLength = 40;
    private const int DaysPerWeek = 7;

    public string Id { get; }
    public string Name { get; }

    /// <summary>Weekday indexes in ascending order, Monday = 0.</summary>
    public IReadOnlyList<int> Days { get; }
    public string Start { get; }
    public string End { get; }
    public IReadOnlyList<RoutineBlock> Blocks { get; }

    /// <summary>Ids of the categories the blocks count toward, without repeats.</summary>
    public IEnumerable<string> CategoryIds =>
        Blocks.Select(block => block.CategoryId).OfType<string>().Distinct();

    private Routine(
        string id, string name, IReadOnlyList<int> days, string start, string end, IReadOnlyList<RoutineBlock> blocks)
    {
        Id = id;
        Name = name;
        Days = days;
        Start = start;
        End = end;
        Blocks = blocks;
    }

    /// <summary>
    /// Builds a valid routine: sorted distinct weekdays, a day that ends after it starts and unique block ids.
    /// </summary>
    /// <example><code>Routine.Create("weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00", blocks).Days.Count; // 5</code></example>
    public static Routine Create(
        string id, string name, IEnumerable<int> days, string start, string end, IEnumerable<RoutineBlock> blocks)
    {
        var blockList = blocks.ToList();
        RequireUniqueBlockIds(blockList);
        var validStart = ClockTime.Require(start, "routine start");
        return new Routine(
            EntityId.Require(id, "routine id"),
            RequiredText.Require(name, MaxNameLength, "routine name"),
            RequireWeekdays(days),
            validStart,
            RequireEndAfter(validStart, end),
            blockList);
    }

    private static List<int> RequireWeekdays(IEnumerable<int> days)
    {
        var sorted = days.Distinct().Order().ToList();
        var invalid = sorted.Where(day => day is < 0 or >= DaysPerWeek).ToList();
        if (invalid.Count > 0)
        {
            throw new DomainRuleException(
                $"Expected weekdays from 0 (Monday) to 6 (Sunday), received [{string.Join(", ", invalid)}]");
        }
        return sorted;
    }

    private static string RequireEndAfter(string start, string end)
    {
        ClockTime.Require(end, "routine end");
        if (ClockTime.ToMinutes(end) <= ClockTime.ToMinutes(start))
        {
            throw new DomainRuleException(
                $"Expected the routine end to be after its start ({start}), received \"{end}\"");
        }
        return end;
    }

    private static void RequireUniqueBlockIds(IReadOnlyList<RoutineBlock> blocks)
    {
        var repeated = blocks.GroupBy(block => block.Id).FirstOrDefault(group => group.Count() > 1);
        if (repeated is not null)
        {
            throw new DomainRuleException(
                $"Expected every block of a routine to have its own id, received \"{repeated.Key}\" more than once");
        }
    }
}
