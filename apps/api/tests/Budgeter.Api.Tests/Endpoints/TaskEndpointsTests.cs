using System.Net;
using System.Net.Http.Json;
using Budgeter.Api.Domain.Tasks;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class TaskEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public TaskEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Put_SavesAWeeklyTaskWithTheRepeatSpelledAsTheWebApp()
    {
        var response = await _client.PutAsJsonAsync("/tasks/t1", new { title = "Gym", repeat = "weekly", days = new[] { 0, 2 } });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("\"repeat\":\"weekly\"");
        body.ShouldNotContain("\"date\"");
    }

    [Fact]
    public async Task Put_OnceWithoutDateIsBadRequest()
    {
        var response = await _client.PutAsJsonAsync("/tasks/t1", new { title = "Call", repeat = "once" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Completions_MarkUnmarkAndListByDate()
    {
        await _client.PutAsJsonAsync("/tasks/t1", new { title = "Read", repeat = "daily" });

        var marked = await _client.PutAsync("/tasks/t1/completions/2026-10-27", null);
        var done = await _client.GetFromJsonAsync<string[]>("/task-completions?date=2026-10-27");
        await _client.DeleteAsync("/tasks/t1/completions/2026-10-27");

        marked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        done.ShouldBe(["t1"]);
        (await _client.GetFromJsonAsync<string[]>("/task-completions?date=2026-10-27")).ShouldBeEmpty();
    }

    [Fact]
    public async Task Completions_OnAnUnknownTaskAreNotFound()
    {
        var response = await _client.PutAsync("/tasks/missing/completions/2026-10-27", null);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_RemovesTheTask()
    {
        await _client.PutAsJsonAsync("/tasks/t1", new { title = "Read", repeat = "daily" });

        var response = await _client.DeleteAsync("/tasks/t1");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await _client.GetFromJsonAsync<TaskResponse[]>("/tasks")).ShouldBeEmpty();
    }
}
