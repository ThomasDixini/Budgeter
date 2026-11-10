using Orbit.Api.Application.Users;
using Orbit.Api.Domain.Users;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Accounts kept in a list, for use case tests.</summary>
internal sealed class InMemoryUserRepository : IUserRepository
{
    private readonly List<StoredUser> _users = [];

    public IReadOnlyList<StoredUser> Users => _users;

    public Task<StoredUser?> FindByEmailAsync(string email, CancellationToken cancellationToken) =>
        Task.FromResult(_users.Find(stored => stored.User.Email == email));

    public Task<User?> AddAsync(User user, string passwordHash, CancellationToken cancellationToken)
    {
        if (_users.Exists(stored => stored.User.Email == user.Email)) return Task.FromResult<User?>(null);
        _users.Add(new StoredUser(user, passwordHash));
        return Task.FromResult<User?>(user);
    }
}

/// <summary>Not a real hash: prefixes the password, which is enough to tell a match from a mismatch.</summary>
internal sealed class FakePasswordHasher : IPasswordHasher
{
    public string Hash(string password) => $"hashed:{password}";

    public bool Verify(string password, string hash) => hash == Hash(password);
}

/// <summary>Issues tokens that name the user and whether they were asked to last.</summary>
internal sealed class FakeTokenIssuer : ITokenIssuer
{
    public AccessToken Issue(User user, bool remember) =>
        new($"token-of-{user.Id}-{(remember ? "long" : "short")}", DateTimeOffset.UnixEpoch);
}

/// <summary>Records the users that were given their starter records.</summary>
internal sealed class RecordingUserProvisioner : IUserProvisioner
{
    public List<string> Provisioned { get; } = [];

    public Task ProvisionAsync(string userId, CancellationToken cancellationToken)
    {
        Provisioned.Add(userId);
        return Task.CompletedTask;
    }
}
