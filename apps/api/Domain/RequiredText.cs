namespace Budgeter.Api.Domain;

/// <summary>Validates free-text fields typed by the user.</summary>
public static class RequiredText
{
    /// <summary>
    /// Returns the trimmed text when it is not blank and fits the limit; throws otherwise.
    /// </summary>
    /// <example><code>RequiredText.Require("  Study ", 40, "category name"); // "Study"</code></example>
    public static string Require(string text, int maxLength, string description)
    {
        var trimmed = text.Trim();
        if (trimmed.Length == 0 || trimmed.Length > maxLength)
        {
            throw new DomainRuleException(
                $"Expected the {description} to have 1-{maxLength} characters, received \"{text}\"");
        }
        return trimmed;
    }
}
