using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Orbit.Api.Application;
using Orbit.Api.Application.Users;

namespace Orbit.Api.Infrastructure.Auth;

/// <summary>Wires password hashing, token issuing and the check of the token every request carries.</summary>
public static class AuthRegistration
{
    /// <summary>
    /// Registers the options (read lazily from configuration), the hasher, the issuer, the current-user
    /// accessor and JWT bearer authentication. Endpoints are closed unless they opt out.
    /// </summary>
    /// <example><code>builder.Services.AddOrbitAuth(isDevelopment, "auth-dev.key");</code></example>
    public static IServiceCollection AddOrbitAuth(
        this IServiceCollection services, bool isDevelopment, string developmentKeyPath)
    {
        services.AddSingleton(provider =>
            AuthOptions.FromConfiguration(
                provider.GetRequiredService<IConfiguration>(), isDevelopment, developmentKeyPath));
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, HttpContextCurrentUser>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<ITokenIssuer, JwtTokenIssuer>();
        services.AddSingleton<SignIn>();
        services.AddScoped<RegisterUser>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<AuthOptions>(Configure);
        services.AddAuthorization(options =>
            options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser().Build());
        return services;
    }

    private static void Configure(JwtBearerOptions bearer, AuthOptions auth)
    {
        // Keep "sub" as it is in the token instead of mapping it to a long claim type.
        bearer.MapInboundClaims = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = auth.Issuer,
            ValidateAudience = true,
            ValidAudience = AuthOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(auth.SigningKey),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    }
}
