using System.Security.Cryptography;
using Orbit.Api.Application.Users;

namespace Orbit.Api.Infrastructure.Auth;

/// <summary>
/// Hashes passwords with PBKDF2-HMAC-SHA256 and a random salt. The stored text is
/// <c>pbkdf2-sha256$iterations$salt$hash</c> (base64), so the cost can be raised later and old hashes still verify.
/// </summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const string Scheme = "pbkdf2-sha256";
    private const int Iterations = 600_000;
    private const int SaltBytes = 16;
    private const int HashBytes = 32;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Derive(password, salt, Iterations, HashBytes);
        return $"{Scheme}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string hash)
    {
        var parts = hash.Split('$');
        if (parts.Length != 4 || parts[0] != Scheme || !int.TryParse(parts[1], out var iterations) || iterations < 1)
        {
            return false;
        }
        var salt = FromBase64(parts[2]);
        var expected = FromBase64(parts[3]);
        if (salt is null || expected is null) return false;
        var actual = Derive(password, salt, iterations, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static byte[] Derive(string password, byte[] salt, int iterations, int length) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, length);

    private static byte[]? FromBase64(string text)
    {
        var buffer = new byte[text.Length];
        if (!Convert.TryFromBase64String(text, buffer, out var written) || written == 0) return null;
        return buffer[..written];
    }
}
