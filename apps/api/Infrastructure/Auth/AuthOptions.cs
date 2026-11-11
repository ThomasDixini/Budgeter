using System.Security.Cryptography;
using System.Text;

namespace Orbit.Api.Infrastructure.Auth;

/// <summary>Settings of the tokens the API issues and accepts.</summary>
/// <param name="SigningKey">From <c>Auth:SigningKey</c>: at least 32 bytes, kept out of source control.</param>
/// <param name="Issuer">From <c>Auth:Issuer</c>; defaults to <c>orbit-api</c>.</param>
/// <param name="Lifetime">From <c>Auth:TokenLifetimeHours</c> (default 12).</param>
/// <param name="RememberedLifetime">From <c>Auth:RememberedTokenLifetimeDays</c> (default 30), for "stay signed in".</param>
public sealed record AuthOptions(byte[] SigningKey, string Issuer, TimeSpan Lifetime, TimeSpan RememberedLifetime)
{
    public const string SigningKeyKey = "Auth:SigningKey";
    public const int MinSigningKeyBytes = 32;
    public const string Audience = "orbit-web";

    /// <summary>
    /// Reads the options. Without a signing key it fails fast, except in Development, where a random key is
    /// made once and kept in <paramref name="developmentKeyPath"/> (outside source control), so a restart of the
    /// API does not sign everyone out.
    /// </summary>
    /// <example><code>var options = AuthOptions.FromConfiguration(builder.Configuration, isDevelopment, "auth-dev.key");</code></example>
    public static AuthOptions FromConfiguration(IConfiguration configuration, bool isDevelopment, string developmentKeyPath)
    {
        return new AuthOptions(
            ReadSigningKey(configuration, isDevelopment, developmentKeyPath),
            configuration["Auth:Issuer"] ?? "orbit-api",
            TimeSpan.FromHours(configuration.GetValue("Auth:TokenLifetimeHours", 12.0)),
            TimeSpan.FromDays(configuration.GetValue("Auth:RememberedTokenLifetimeDays", 30.0)));
    }

    private static byte[] ReadSigningKey(IConfiguration configuration, bool isDevelopment, string developmentKeyPath)
    {
        var configured = configuration[SigningKeyKey];
        if (string.IsNullOrEmpty(configured))
        {
            if (isDevelopment) return ReadOrCreateDevelopmentKey(developmentKeyPath);
            throw new InvalidOperationException(
                $"Expected {SigningKeyKey} with at least {MinSigningKeyBytes} characters, received none");
        }
        var bytes = Encoding.UTF8.GetBytes(configured);
        if (bytes.Length < MinSigningKeyBytes)
        {
            throw new InvalidOperationException(
                $"Expected {SigningKeyKey} with at least {MinSigningKeyBytes} characters, received {bytes.Length}");
        }
        return bytes;
    }

    private static byte[] ReadOrCreateDevelopmentKey(string path)
    {
        if (File.Exists(path)) return Convert.FromBase64String(File.ReadAllText(path).Trim());
        var key = RandomNumberGenerator.GetBytes(MinSigningKeyBytes);
        File.WriteAllText(path, Convert.ToBase64String(key));
        return key;
    }
}
