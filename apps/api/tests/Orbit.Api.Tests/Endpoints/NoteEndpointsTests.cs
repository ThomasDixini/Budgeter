using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class NoteEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public NoteEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private Task<HttpResponseMessage> PutAsync(string id, string kind, string title, string? body = "") =>
        _client.PutAsJsonAsync($"/notes/{id}", new { kind, title, body });

    private Task<HttpResponseMessage> PutStatusAsync(string id, string status) =>
        _client.PutAsJsonAsync($"/notes/{id}/status", new { status });

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private async Task<string[]> ListIdsAsync()
    {
        var list = await ReadAsync(await _client.GetAsync("/notes"));
        return list.EnumerateArray().Select(item => item.GetProperty("id").GetString()!).ToArray();
    }

    [Theory]
    [InlineData("goal")]
    [InlineData("note")]
    [InlineData("idea")]
    public async Task Put_CreatesAnOpenNoteWithTheKindSpelledAsAString(string kind)
    {
        var response = await PutAsync("n1", kind, "Run a 10k", "Weekly plan");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var note = await ReadAsync(response);
        (note.GetProperty("id").GetString(), note.GetProperty("kind").GetString(), note.GetProperty("title").GetString(),
            note.GetProperty("body").GetString(), note.GetProperty("status").GetString())
            .ShouldBe(("n1", kind, "Run a 10k", "Weekly plan", "open"));
    }

    [Fact]
    public async Task Put_ReturnsIsoTimestampsWithAnOffset()
    {
        var note = await ReadAsync(await PutAsync("n1", "note", "Title"));

        foreach (var property in new[] { "createdAt", "updatedAt" })
        {
            var text = note.GetProperty(property).GetString()!;
            DateTimeOffset.TryParse(text, out var parsed).ShouldBeTrue();
            (parsed.Offset, text.EndsWith("+00:00", StringComparison.Ordinal)).ShouldBe((TimeSpan.Zero, true));
        }
    }

    [Fact]
    public async Task Put_AgainEditsTheNoteKeepingCreatedAtAndMovingUpdatedAtForward()
    {
        var created = await ReadAsync(await PutAsync("n1", "note", "First"));
        await Task.Delay(20);

        var edited = await ReadAsync(await PutAsync("n1", "idea", "Second", "More"));

        (edited.GetProperty("title").GetString(), edited.GetProperty("kind").GetString(), edited.GetProperty("status").GetString())
            .ShouldBe(("Second", "idea", "open"));
        edited.GetProperty("createdAt").GetString().ShouldBe(created.GetProperty("createdAt").GetString());
        edited.GetProperty("updatedAt").GetDateTimeOffset()
            .ShouldBeGreaterThanOrEqualTo(created.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Get_ListsTheMostRecentlyUpdatedFirst()
    {
        await PutAsync("a", "note", "A");
        await Task.Delay(20);
        await PutAsync("b", "note", "B");
        await Task.Delay(20);
        await PutAsync("a", "note", "A again");

        (await ListIdsAsync()).ShouldBe(["a", "b"]);
    }

    [Theory]
    [InlineData("goal", "done")]
    [InlineData("idea", "done")]
    [InlineData("note", "archived")]
    public async Task PutStatus_SetsTheStatusAndAllowsReopening(string kind, string status)
    {
        await PutAsync("n1", kind, "Title");

        var changed = await ReadAsync(await PutStatusAsync("n1", status));
        var reopened = await ReadAsync(await PutStatusAsync("n1", "open"));

        (changed.GetProperty("status").GetString(), reopened.GetProperty("status").GetString())
            .ShouldBe((status, "open"));
    }

    [Fact]
    public async Task PutStatus_DoneOnANoteIsBadRequestNamingTheKind()
    {
        await PutAsync("n1", "note", "Title");

        var response = await PutStatusAsync("n1", "done");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("Note");
    }

    [Fact]
    public async Task PutStatus_UnknownIdIsNotFound()
    {
        var response = await PutStatusAsync("missing", "archived");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_RemovesTheNoteAndAnUnknownIdAlsoReturnsNoContent()
    {
        await PutAsync("n1", "note", "Title");

        var removed = await _client.DeleteAsync("/notes/n1");
        var unknown = await _client.DeleteAsync("/notes/missing");

        (removed.StatusCode, unknown.StatusCode, await ListIdsAsync())
            .ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent, Array.Empty<string>()));
    }

    [Fact]
    public async Task Put_BlankTitleIsBadRequestNamingTheValue()
    {
        var response = await PutAsync("n1", "note", "   ");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("note title");
    }

    [Fact]
    public async Task Put_TitleOver80CharactersIsBadRequest()
    {
        var response = await PutAsync("n1", "note", new string('t', 81));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_BodyOver4000CharactersIsBadRequest()
    {
        var response = await PutAsync("n1", "note", "Title", new string('b', 4001));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_ABodyOfExactlyTheLimitIsAccepted()
    {
        var response = await PutAsync("n1", "note", new string('t', 80), new string('b', 4000));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Put_AMissingBodyIsStoredAsEmptyText()
    {
        var response = await _client.PutAsJsonAsync("/notes/n1", new { kind = "note", title = "Title" });

        (await ReadAsync(response)).GetProperty("body").GetString().ShouldBe("");
    }

    [Fact]
    public async Task Put_AnUnknownKindIsBadRequest()
    {
        var response = await PutAsync("n1", "task", "Title");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_ABodyWithLineBreaksQuotesAndEmojiRoundTripsUnchanged()
    {
        const string body = "line one\r\nline \"two\"\n\ttabbed — café \U0001F680";
        await PutAsync("n1", "idea", "Title", body);

        var list = await ReadAsync(await _client.GetAsync("/notes"));

        list[0].GetProperty("body").GetString().ShouldBe(body);
    }

    [Fact]
    public async Task EveryRoute_RejectsARequestWithoutAToken()
    {
        var anonymous = _factory.CreateAnonymousClient();

        var list = await anonymous.GetAsync("/notes");
        var save = await anonymous.PutAsJsonAsync("/notes/n1", new { kind = "note", title = "T" });
        var status = await anonymous.PutAsJsonAsync("/notes/n1/status", new { status = "open" });
        var delete = await anonymous.DeleteAsync("/notes/n1");

        new[] { list, save, status, delete }.Select(response => response.StatusCode)
            .ShouldAllBe(code => code == HttpStatusCode.Unauthorized);
    }
}
