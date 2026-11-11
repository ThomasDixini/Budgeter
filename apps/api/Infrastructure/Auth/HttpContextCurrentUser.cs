using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Orbit.Api.Application;

namespace Orbit.Api.Infrastructure.Auth;

/// <summary>The signed-in user of the running HTTP request, read from the token's subject.</summary>
public sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public string Id
    {
        get
        {
            var principal = accessor.HttpContext?.User;
            var id = principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return string.IsNullOrEmpty(id)
                ? throw new InvalidOperationException("Expected a request from a signed-in user, received none")
                : id;
        }
    }
}
