using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using Orbit.Api.Application.Users;
using Orbit.Api.Domain.Users;

namespace Orbit.Api.Infrastructure.Auth;

/// <summary>Issues HS256-signed JWTs whose subject is the user id.</summary>
public sealed class JwtTokenIssuer(AuthOptions options, TimeProvider clock) : ITokenIssuer
{
    public AccessToken Issue(User user, bool remember)
    {
        var now = clock.GetUtcNow();
        var expiresAt = now + (remember ? options.RememberedLifetime : options.Lifetime);
        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: AuthOptions.Audience,
            claims: [new Claim(JwtRegisteredClaimNames.Sub, user.Id), new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())],
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(options.SigningKey), SecurityAlgorithms.HmacSha256));
        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
