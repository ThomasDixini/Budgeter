using Orbit.Api.Application.Users;
using Orbit.Api.Domain.Users;

namespace Orbit.Api.Endpoints;

public sealed record RegisterRequest(string Name, string Email, string Password);

/// <summary>Body of <c>POST /auth/login</c>; <c>remember</c> asks for a token that lasts weeks, not hours.</summary>
public sealed record LoginRequest(string Email, string Password, bool Remember = false);

public sealed record UserResponse(string Id, string Email, string Name)
{
    public static UserResponse From(User user) => new(user.Id, user.Email, user.Name);
}

/// <summary>The token to send as <c>Authorization: Bearer ...</c>, when it stops working, and who it is for.</summary>
public sealed record AuthResponse(string Token, DateTimeOffset ExpiresAt, UserResponse User)
{
    public static AuthResponse From(Session session) =>
        new(session.Token.Value, session.Token.ExpiresAt, UserResponse.From(session.User));
}

/// <summary>HTTP routes to create an account and to sign in; the only ones open to everyone.</summary>
public static class AuthEndpoints
{
    /// <summary>
    /// Maps <c>POST /auth/register</c> (201 with the first session, 409 when the e-mail has an account) and
    /// <c>POST /auth/login</c> (200 with a session, 401 when the credentials do not match).
    /// </summary>
    /// <example><code>app.MapAuthEndpoints();</code></example>
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/auth/register", RegisterAsync).AllowAnonymous();
        routes.MapPost("/auth/login", LoginAsync).AllowAnonymous();
        return routes;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request, RegisterUser registerUser, CancellationToken cancellationToken)
    {
        var session = await registerUser.ExecuteAsync(
            new RegisterUserCommand(request.Name, request.Email, request.Password), cancellationToken);
        return Results.Created("/auth/me", AuthResponse.From(session));
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request, SignIn signIn, CancellationToken cancellationToken)
    {
        var session = await signIn.ExecuteAsync(
            new SignInCommand(request.Email, request.Password, request.Remember), cancellationToken);
        return Results.Ok(AuthResponse.From(session));
    }
}
