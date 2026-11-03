namespace Budgeter.Api.Domain.Finances;

/// <summary>
/// What money went to or came from (food, salary…). Kept apart from the routines
/// <see cref="Categories.Category"/>: a life area and a spending bucket are different things.
/// </summary>
public sealed class FinanceCategory
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }

    private FinanceCategory(string id, string name)
    {
        Id = id;
        Name = name;
    }

    /// <summary>
    /// Builds a valid finance category, trimming the name.
    /// </summary>
    /// <example><code>FinanceCategory.Create("food", " Food ").Name; // "Food"</code></example>
    public static FinanceCategory Create(string id, string name)
    {
        return new FinanceCategory(
            EntityId.Require(id, "finance category id"),
            RequiredText.Require(name, MaxNameLength, "finance category name"));
    }

    /// <summary>
    /// Rebuilds a stored finance category as it was saved, without today's rules.
    /// </summary>
    /// <example><code>FinanceCategory.Restore("food", "Food");</code></example>
    internal static FinanceCategory Restore(string id, string name) => new(id, name);
}
