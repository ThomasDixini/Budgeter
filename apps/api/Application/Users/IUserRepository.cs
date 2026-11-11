using Orbit.Api.Domain.Users;

namespace Orbit.Api.Application.Users;

/// <summary>A user with the hash of their password, as stored; the hash never leaves the application layer.</summary>
public sealed record StoredUser(User User, string PasswordHash);

/// <summary>Port to the storage of accounts.</summary>
public interface IUserRepository
{
    /// <summary>The user with this normalized e-mail, or null when there is none.</summary>
    Task<StoredUser?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>
    /// Stores a new account and returns it as stored; null, storing nothing, when the e-mail is already taken.
    /// Checked and written in one statement, so two sign-ups arriving together cannot both succeed. The
    /// first account of a database that already held data takes that data over, so the returned user can
    /// carry an id other than the one given.
    /// </summary>
    Task<User?> AddAsync(User user, string passwordHash, CancellationToken cancellationToken);
}
