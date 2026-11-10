using Orbit.Api.Domain;
using Orbit.Api.Domain.Users;

namespace Orbit.Api.Application.Users;

public sealed record SignInCommand(string Email, string Password, bool Remember);

/// <summary>Checks an e-mail and password and opens a session.</summary>
public sealed class SignIn(IUserRepository users, IPasswordHasher hasher, ITokenIssuer tokens)
{
    // Verified when the e-mail is unknown, so that case costs as much time as a wrong password and the
    // response time does not reveal which e-mails have an account.
    private readonly string _decoyHash = hasher.Hash(Guid.NewGuid().ToString());

    /// <summary>
    /// Returns the session for matching credentials; throws <see cref="UnauthorizedException"/> otherwise.
    /// A malformed e-mail is treated as a mismatch, not as a validation error.
    /// </summary>
    /// <example><code>var session = await signIn.ExecuteAsync(new("ana@mail.com", "orbit-2026", Remember: true), ct);</code></example>
    public async Task<Session> ExecuteAsync(SignInCommand command, CancellationToken cancellationToken)
    {
        var stored = await FindAsync(command.Email, cancellationToken);
        var matches = hasher.Verify(command.Password, stored?.PasswordHash ?? _decoyHash);
        if (stored is null || !matches) throw new UnauthorizedException();
        return new Session(stored.User, tokens.Issue(stored.User, command.Remember));
    }

    private async Task<StoredUser?> FindAsync(string email, CancellationToken cancellationToken)
    {
        try
        {
            return await users.FindByEmailAsync(EmailAddress.Normalize(email), cancellationToken);
        }
        catch (DomainRuleException)
        {
            return null;
        }
    }
}
