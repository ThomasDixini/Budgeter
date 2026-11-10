using Orbit.Api.Domain.Users;

namespace Orbit.Api.Application.Users;

public sealed record RegisterUserCommand(string Name, string Email, string Password);

/// <summary>What a client gets once signed in: the token to send from now on, and who it is for.</summary>
public sealed record Session(User User, AccessToken Token);

/// <summary>Creates an account, gives it its starter records and signs it in.</summary>
public sealed class RegisterUser(
    IUserRepository users,
    IPasswordHasher hasher,
    IUserProvisioner provisioner,
    ITokenIssuer tokens)
{
    /// <summary>
    /// Validates, stores the account and returns its first session; an e-mail that already has an
    /// account is a conflict.
    /// </summary>
    /// <example><code>var session = await registerUser.ExecuteAsync(new("Ana", "ana@mail.com", "orbit-2026"), ct);</code></example>
    public async Task<Session> ExecuteAsync(RegisterUserCommand command, CancellationToken cancellationToken)
    {
        var draft = User.Register(command.Email, command.Name);
        var hash = hasher.Hash(PasswordPolicy.Require(command.Password));
        var user = await users.AddAsync(draft, hash, cancellationToken)
            ?? throw new ConflictException($"Expected an e-mail with no account yet, received \"{draft.Email}\"");
        await provisioner.ProvisionAsync(user.Id, cancellationToken);
        return new Session(user, tokens.Issue(user, remember: false));
    }
}
