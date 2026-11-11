using Orbit.Api.Domain.Users;

namespace Orbit.Api.Application.Users;

/// <summary>An access token and the moment it stops being accepted.</summary>
public sealed record AccessToken(string Value, DateTimeOffset ExpiresAt);

/// <summary>Port that mints the token a client sends with every request.</summary>
public interface ITokenIssuer
{
    /// <summary>Issues a token for the user; a long-lived one when they asked to stay signed in.</summary>
    AccessToken Issue(User user, bool remember);
}
