using System.Net.Http.Headers;
using System.Net.Http.Json;
using Orbit.Api.Endpoints;
using Orbit.Api.Infrastructure.Auth;
using Orbit.Api.Infrastructure.Cdi;
using Orbit.Api.Infrastructure.Quotes;
using Orbit.Api.Infrastructure.Sqlite;
using Orbit.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Orbit.Api.Tests.Endpoints;

/// <summary>The real API backed by a throwaway SQLite file without sample data.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    /// <summary>A key long enough to sign tokens; only for specs.</summary>
    public const string SigningKey = "test-signing-key-test-signing-key-0123456789";
    public const string DefaultEmail = "ana@test.local";
    public const string DefaultPassword = "orbit-test-pass";

    private readonly TemporarySqliteDatabase _database = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting($"ConnectionStrings:{SqliteOptions.ConnectionStringName}", _database.ConnectionString);
        builder.UseSetting(SqliteOptions.SeedSampleDataKey, "false");
        builder.UseSetting(CdiRegistration.EnabledKey, "false");
        builder.UseSetting(QuotesRegistration.EnabledKey, "false");
        builder.UseSetting(AuthOptions.SigningKeyKey, SigningKey);
    }

    /// <summary>A client signed in as a user created for the spec; every call it makes acts for that user.</summary>
    /// <example><code>var client = factory.CreateClient();</code></example>
    public new HttpClient CreateClient() => CreateClientFor(DefaultEmail);

    /// <summary>A client signed in as the user with this e-mail, who is created on first use.</summary>
    /// <example><code>var other = factory.CreateClientFor("bia@test.local");</code></example>
    public HttpClient CreateClientFor(string email)
    {
        var client = base.CreateClient();
        var token = RegisterOrSignInAsync(client, email).GetAwaiter().GetResult();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>A client that sends no token.</summary>
    /// <example><code>var anonymous = factory.CreateAnonymousClient();</code></example>
    public HttpClient CreateAnonymousClient() => base.CreateClient();

    private static async Task<string> RegisterOrSignInAsync(HttpClient client, string email)
    {
        var registered = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest("Test User", email, DefaultPassword));
        if (!registered.IsSuccessStatusCode)
        {
            registered = await client.PostAsJsonAsync("/auth/login", new LoginRequest(email, DefaultPassword));
        }
        registered.EnsureSuccessStatusCode();
        return (await registered.Content.ReadFromJsonAsync<AuthResponse>())!.Token;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _database.Dispose();
    }
}
