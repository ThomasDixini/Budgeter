using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Budgeter.Api.Endpoints;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class BackupEndpointsTests : IDisposable
{
    private static readonly CreateCategoryRequest Study = new("study", "Study", "#7dd3fc");
    private static readonly CreateCategoryRequest Music = new("music", "Music", "#86efac");

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public BackupEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Get_DownloadsTheDatabaseAsANamedSqliteFile()
    {
        var response = await _client.GetAsync("/backup");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/vnd.sqlite3");
        response.Content.Headers.ContentDisposition!.FileName.ShouldStartWith("budgeter-backup-");
        (await response.Content.ReadAsByteArrayAsync())[..15].ShouldBe("SQLite format 3"u8.ToArray());
    }

    [Fact]
    public async Task PostRestore_PutsBackTheDataOfTheDownloadedBackup()
    {
        await _client.PostAsJsonAsync("/categories", Study);
        var backup = await _client.GetByteArrayAsync("/backup");
        await _client.PostAsJsonAsync("/categories", Music);

        var response = await _client.PostAsync("/backup/restore", SqliteBody(backup));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var categories = await _client.GetFromJsonAsync<CategoryResponse[]>("/categories");
        categories!.Select(category => category.Id).ShouldBe(["study"]);
    }

    [Fact]
    public async Task PostRestore_FileThatIsNotABackupIsBadRequestAndKeepsTheData()
    {
        await _client.PostAsJsonAsync("/categories", Study);

        var response = await _client.PostAsync("/backup/restore", SqliteBody("hello"u8.ToArray()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("not a SQLite database");
        (await _client.GetFromJsonAsync<CategoryResponse[]>("/categories"))!.Length.ShouldBe(1);
    }

    // The API-wide cap is 256 KB, far less than a database with a few years of data.
    [Fact]
    public void PostRestore_AcceptsBackupsUpTo64Megabytes()
    {
        var endpoints = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints;

        var restore = endpoints.OfType<RouteEndpoint>().Single(endpoint => endpoint.RoutePattern.RawText == "/backup/restore");

        restore.Metadata.GetMetadata<IRequestSizeLimitMetadata>()!.MaxRequestBodySize.ShouldBe(BackupEndpoints.MaxBackupBytes);
        BackupEndpoints.MaxBackupBytes.ShouldBe(64L * 1024 * 1024);
    }

    private static ByteArrayContent SqliteBody(byte[] bytes)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.sqlite3");
        return content;
    }
}
