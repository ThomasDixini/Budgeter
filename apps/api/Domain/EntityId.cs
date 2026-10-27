using System.Text.RegularExpressions;

namespace Budgeter.Api.Domain;

/// <summary>
/// Validates identifiers. Clients generate them (UUIDs) so offline creations can be retried idempotently.
/// </summary>
public static partial class EntityId
{
    private const int MaxLength = 64;

    /// <summary>
    /// Returns the id when it is 1–64 letters, digits or dashes; throws otherwise.
    /// </summary>
    /// <example><code>EntityId.Require("3f2b7c1e-0d4a-4c55-9a51-6b1f6c2d8e90", "category id");</code></example>
    public static string Require(string id, string description)
    {
        if (id.Length > MaxLength || !IdPattern().IsMatch(id))
        {
            throw new DomainRuleException(
                $"Expected the {description} to be 1-{MaxLength} letters, digits or dashes, received \"{id}\"");
        }
        return id;
    }

    [GeneratedRegex("^[A-Za-z0-9-]+$")]
    private static partial Regex IdPattern();
}
