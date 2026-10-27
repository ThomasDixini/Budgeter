namespace Budgeter.Api.Domain.Routines;

/// <summary>
/// A slice of a routine day, optionally tied to a category so it counts toward that category's goals.
/// Blocks may overlap or run past the day: the editor warns about it but lets the user keep it.
/// </summary>
public sealed class RoutineBlock
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }
    public string Start { get; }
    public string End { get; }
    public string? CategoryId { get; }

    private RoutineBlock(string id, string name, string start, string end, string? categoryId)
    {
        Id = id;
        Name = name;
        Start = start;
        End = end;
        CategoryId = categoryId;
    }

    /// <summary>
    /// Builds a valid block, trimming its name.
    /// </summary>
    /// <example><code>RoutineBlock.Create("csharp", "C# study", "13:30", "15:00", "study").CategoryId; // "study"</code></example>
    public static RoutineBlock Create(string id, string name, string start, string end, string? categoryId)
    {
        return new RoutineBlock(
            EntityId.Require(id, "block id"),
            RequiredText.Require(name, MaxNameLength, "block name"),
            ClockTime.Require(start, "block start"),
            ClockTime.Require(end, "block end"),
            categoryId is null ? null : EntityId.Require(categoryId, "block category id"));
    }
}
