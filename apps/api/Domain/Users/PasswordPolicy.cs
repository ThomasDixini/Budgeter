namespace Orbit.Api.Domain.Users;

/// <summary>What a new password must satisfy; signing in only needs it to match, never these rules.</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    // Bounds the work of hashing: a multi-megabyte "password" would be a cheap way to burn CPU.
    public const int MaxLength = 128;

    /// <summary>
    /// Returns the password unchanged (spaces are part of it) when it has 8-128 characters; throws otherwise.
    /// The message never contains the password itself.
    /// </summary>
    /// <example><code>PasswordPolicy.Require("correct horse battery");</code></example>
    public static string Require(string password)
    {
        if (password.Length is < MinLength or > MaxLength)
        {
            throw new DomainRuleException(
                $"Expected the password to have {MinLength}-{MaxLength} characters, received {password.Length}");
        }
        return password;
    }
}
