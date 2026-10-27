using System.Text.RegularExpressions;

namespace Budgeter.Api.Domain.Categories;

/// <summary>A life area (study, networking…) that groups routine blocks and goals.</summary>
public sealed partial class Category
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }

    /// <summary>Accent shaped like <c>#RRGGBB</c>.</summary>
    public string Color { get; }

    private Category(string id, string name, string color)
    {
        Id = id;
        Name = name;
        Color = color;
    }

    /// <summary>
    /// Builds a valid category, trimming the name and normalizing the color to upper case.
    /// </summary>
    /// <example><code>Category.Create("languages", "Languages", "#86efac").Color; // "#86EFAC"</code></example>
    public static Category Create(string id, string name, string color)
    {
        return new Category(
            EntityId.Require(id, "category id"),
            RequiredText.Require(name, MaxNameLength, "category name"),
            RequireColor(color));
    }

    private static string RequireColor(string color)
    {
        if (!HexColorPattern().IsMatch(color))
        {
            throw new DomainRuleException($"Expected a color shaped like #RRGGBB, received \"{color}\"");
        }
        return color.ToUpperInvariant();
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexColorPattern();
}
