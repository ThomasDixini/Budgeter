using System.Text.RegularExpressions;

namespace Orbit.Api.Domain.Users;

/// <summary>Validates and normalizes the e-mail a person signs in with.</summary>
public static partial class EmailAddress
{
    private const int MaxLength = 254;

    /// <summary>
    /// Returns the address trimmed and in lower case, so "Ana@Mail.com " and "ana@mail.com" are one account;
    /// throws when it is not shaped like <c>name@domain.tld</c>.
    /// </summary>
    /// <example><code>EmailAddress.Normalize(" Ana@Mail.com "); // "ana@mail.com"</code></example>
    public static string Normalize(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (normalized.Length > MaxLength || !Shape().IsMatch(normalized))
        {
            throw new DomainRuleException(
                $"Expected an e-mail shaped like name@domain.com (up to {MaxLength} characters), received {ReceivedValue.Quote(email)}");
        }
        return normalized;
    }

    // \z, not $: in .NET "$" also matches before a final newline.
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+\z")]
    private static partial Regex Shape();
}
