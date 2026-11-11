namespace Orbit.Api.Application.Users;

/// <summary>Port that turns a password into something safe to store, and checks a password against it.</summary>
public interface IPasswordHasher
{
    /// <summary>A salted, slow hash of the password, with everything needed to verify it later.</summary>
    string Hash(string password);

    /// <summary>Tells whether the password produced the hash; false, never an error, for a malformed hash.</summary>
    bool Verify(string password, string hash);
}
