using System.Text.RegularExpressions;

namespace Orbit.Api.Domain.Categories;

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

    /// <summary>
    /// Rebuilds a stored category as it was saved, without today's rules: a row valid when written must
    /// still read after a rule gets stricter, or one old row would break every list.
    /// </summary>
    /// <example><code>Category.Restore("languages", "Languages", "#86EFAC");</code></example>
    internal static Category Restore(string id, string name, string color) => new(id, name, color);

    /// <summary>
    /// Whether the other category has the same name and color, as a retried create must.
    /// </summary>
    /// <example><code>stored.HasSameContentAs(Category.Create("study", "Study", "#7dd3fc")); // true</code></example>
    public bool HasSameContentAs(Category other) => Name == other.Name && Color == other.Color;

    /// <summary>
    /// Name and color, for messages.
    /// </summary>
    /// <example><code>category.Describe(); // "name \"Study\", color #7DD3FC"</code></example>
    public string Describe() => $"name {ReceivedValue.Quote(Name)}, color {Color}";

    private static string RequireColor(string color)
    {
        if (!HexColorPattern().IsMatch(color))
        {
            throw new DomainRuleException(
                $"Expected a color shaped like #RRGGBB, received {ReceivedValue.Quote(color)}");
        }
        return color.ToUpperInvariant();
    }

    // \z, not $: in .NET "$" also matches before a final newline, and the web app cannot draw "#86EFAC\n".
    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}\z")]
    private static partial Regex HexColorPattern();
}
