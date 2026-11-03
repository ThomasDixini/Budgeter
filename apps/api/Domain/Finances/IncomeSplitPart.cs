namespace Budgeter.Api.Domain.Finances;

/// <summary>One share of the income: a name, a percentage, a display color and the categories it spends on.</summary>
public sealed class IncomeSplitPart
{
    public const int MaxNameLength = 40;
    public const int MaxPercent = 100;

    /// <summary>How many display colors the screen offers; a part stores which one it uses.</summary>
    public const int ColorCount = 6;

    public string Id { get; }
    public string Name { get; }
    public int Percent { get; }
    public int Color { get; }
    public IReadOnlyList<string> CategoryIds { get; }

    private IncomeSplitPart(string id, string name, int percent, int color, IReadOnlyList<string> categoryIds)
    {
        Id = id;
        Name = name;
        Percent = percent;
        Color = color;
        CategoryIds = categoryIds;
    }

    /// <summary>
    /// Builds a valid part: trimmed name, a whole percentage from 0 to 100, one of the display colors and
    /// valid category ids.
    /// </summary>
    /// <example><code>IncomeSplitPart.Create("fixed", " Fixed costs ", 50, 0, ["housing"]).Name; // "Fixed costs"</code></example>
    public static IncomeSplitPart Create(string id, string name, int percent, int color, IReadOnlyList<string> categoryIds)
    {
        return new IncomeSplitPart(
            EntityId.Require(id, "income split part id"),
            RequiredText.Require(name, MaxNameLength, "income split part name"),
            RequireInRange(percent, MaxPercent, "percentage"),
            RequireInRange(color, ColorCount - 1, "color"),
            categoryIds.Select(categoryId => EntityId.Require(categoryId, "income split category id")).ToList());
    }

    /// <summary>
    /// Rebuilds a stored part as it was saved, without today's rules.
    /// </summary>
    /// <example><code>IncomeSplitPart.Restore("fixed", "Fixed costs", 50, 0, ["housing"]);</code></example>
    internal static IncomeSplitPart Restore(string id, string name, int percent, int color, IReadOnlyList<string> categoryIds) =>
        new(id, name, percent, color, categoryIds);

    private static int RequireInRange(int value, int max, string description)
    {
        if (value >= 0 && value <= max) return value;
        throw new DomainRuleException($"Expected the income split part {description} to be a whole number from 0 to {max}, received {value}");
    }
}
