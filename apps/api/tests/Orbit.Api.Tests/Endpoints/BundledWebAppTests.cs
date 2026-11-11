using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Orbit.Api.Infrastructure.Auth;
using Orbit.Api.Infrastructure.Cdi;
using Orbit.Api.Infrastructure.Quotes;
using Orbit.Api.Infrastructure.Sqlite;
using Orbit.Api.Tests.Infrastructure;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

/// <summary>The API with a compiled web app in its web root, as a published build has.</summary>
public sealed class BundledWebAppFactory : WebApplicationFactory<Program>
{
    public const string StartPage = "<html>orbit start page</html>";
    private readonly TemporarySqliteDatabase _database = new();
    private readonly string _webRoot = Directory.CreateTempSubdirectory("orbit-wwwroot-").FullName;

    public BundledWebAppFactory()
    {
        File.WriteAllText(Path.Combine(_webRoot, "index.html"), StartPage);
        File.WriteAllText(Path.Combine(_webRoot, "main.js"), "console.log('orbit');");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseWebRoot(_webRoot);
        builder.UseSetting($"ConnectionStrings:{SqliteOptions.ConnectionStringName}", _database.ConnectionString);
        builder.UseSetting(CdiRegistration.EnabledKey, "false");
        builder.UseSetting(QuotesRegistration.EnabledKey, "false");
        builder.UseSetting(AuthOptions.SigningKeyKey, ApiFactory.SigningKey);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        _database.Dispose();
        if (Directory.Exists(_webRoot)) Directory.Delete(_webRoot, recursive: true);
    }
}

public class BundledWebAppTests : IClassFixture<BundledWebAppFactory>
{
    private readonly HttpClient _client;

    public BundledWebAppTests(BundledWebAppFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/finances/transactions")]
    [InlineData("/routines")]
    public async Task GetPage_AnswersTheStartPageEvenWhenTheApiHasARouteOfThatName(string path)
    {
        var response = await _client.GetAsync(path);

        (response.StatusCode, await response.Content.ReadAsStringAsync())
            .ShouldBe((HttpStatusCode.OK, BundledWebAppFactory.StartPage));
    }

    [Fact]
    public async Task GetFile_AnswersTheFileItself()
    {
        var response = await _client.GetAsync("/main.js");

        (await response.Content.ReadAsStringAsync()).ShouldBe("console.log('orbit');");
    }

    [Fact]
    public async Task GetApiRoute_StillRequiresASignedInUser()
    {
        var response = await _client.GetAsync("/api/routines");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/health")]
    public async Task GetHealth_AnswersNoContentWithOrWithoutTheApiPrefix(string path)
    {
        var response = await _client.GetAsync(path);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }
}
