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

/// <summary>The real API backed by a throwaway SQLite file.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    /// <summary>A key long enough to sign tokens; only for specs.</summary>
    public const string SigningKey = "test-signing-key-test-signing-key-0123456789";
    public const string DefaultEmail = "ana@test.local";
    public const string DefaultPassword = "orbit-test-pass";

    private static readonly (string Id, string Name)[] FinanceCategories =
    [
        ("housing", "Housing"), ("food", "Food"), ("transport", "Transport"), ("health", "Health"),
        ("leisure", "Leisure"), ("subscriptions", "Subscriptions"), ("education", "Education"),
        ("salary", "Salary"), ("extra-income", "Extra income"), ("investments", "Investments"), ("other", "Other"),
    ];

    private readonly TemporarySqliteDatabase _database = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting($"ConnectionStrings:{SqliteOptions.ConnectionStringName}", _database.ConnectionString);
        builder.UseSetting(CdiRegistration.EnabledKey, "false");
        builder.UseSetting(QuotesRegistration.EnabledKey, "false");
        builder.UseSetting(AuthOptions.SigningKeyKey, SigningKey);
    }

    /// <summary>
    /// A client signed in as a user created for the spec, who has the finance categories and accounts the
    /// specs record against (an account starts empty); every call it makes acts for that user.
    /// </summary>
    /// <example><code>var client = factory.CreateClient();</code></example>
    public new HttpClient CreateClient() => CreateClientFor(DefaultEmail);

    /// <summary>A client signed in as the user with this e-mail, who is created (and given the finance set) on first use.</summary>
    /// <example><code>var other = factory.CreateClientFor("bia@test.local");</code></example>
    public HttpClient CreateClientFor(string email)
    {
        var client = CreateAnonymousClient();
        var (token, isNew) = RegisterOrSignInAsync(client, email).GetAwaiter().GetResult();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (isNew) SeedFinanceAsync(client).GetAwaiter().GetResult();
        return client;
    }

    /// <summary>A client that sends no token, and whose user has nothing yet.</summary>
    /// <example><code>var anonymous = factory.CreateAnonymousClient();</code></example>
    public HttpClient CreateAnonymousClient() => base.CreateClient();

    /// <summary>A client for a user with no records at all, not even the finance set.</summary>
    /// <example><code>var fresh = factory.CreateEmptyClientFor("new@test.local");</code></example>
    public HttpClient CreateEmptyClientFor(string email)
    {
        var client = CreateAnonymousClient();
        var (token, _) = RegisterOrSignInAsync(client, email).GetAwaiter().GetResult();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<(string Token, bool IsNew)> RegisterOrSignInAsync(HttpClient client, string email)
    {
        var registered = await client.PostAsJsonAsync(
            "/auth/register", new RegisterRequest("Test User", email, DefaultPassword));
        var isNew = registered.IsSuccessStatusCode;
        if (!isNew)
        {
            registered = await client.PostAsJsonAsync("/auth/login", new LoginRequest(email, DefaultPassword));
        }
        registered.EnsureSuccessStatusCode();
        return ((await registered.Content.ReadFromJsonAsync<AuthResponse>())!.Token, isNew);
    }

    private static async Task SeedFinanceAsync(HttpClient client)
    {
        foreach (var (id, name) in FinanceCategories)
        {
            (await client.PutAsJsonAsync($"/finance-categories/{id}", new SaveFinanceCategoryRequest(name)))
                .EnsureSuccessStatusCode();
        }
        // Enums travel as the web app spells them, so the bodies are written as the web app sends them.
        (await client.PutAsJsonAsync("/accounts/checking-account", new { name = "Checking account", kind = "bankAccount" }))
            .EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync(
            "/accounts/credit-card",
            new { name = "Credit card", kind = "creditCard", card = new { limitCents = 500_000, closingDay = 3, dueDay = 10 } }))
            .EnsureSuccessStatusCode();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _database.Dispose();
    }
}
