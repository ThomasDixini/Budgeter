using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

/// <summary>Completing a block or a task over HTTP moves the goal that is tracked from it.</summary>
public sealed class GoalCreditEndpointsTests : IAsyncLifetime, IDisposable
{
    private const string Day = "2026-10-28";
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public GoalCreditEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        (await _client.PostAsJsonAsync("/categories", new CreateCategoryRequest("study", "Study", "#7DD3FC")))
            .EnsureSuccessStatusCode();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _factory.Dispose();

    private async Task CreateGoalAsync(string tracking)
    {
        (await _client.PostAsJsonAsync($"/goals?date={Day}", new
        {
            id = "g1",
            categoryId = "study",
            title = "Study",
            type = "frequency",
            period = "weekly",
            target = 5,
            tracking,
        })).EnsureSuccessStatusCode();
    }

    private async Task<int> DoneAsync() =>
        (await _client.GetFromJsonAsync<JsonArray>($"/goals?date={Day}"))!.Single()!["done"]!.GetValue<int>();

    [Fact]
    public async Task ACompletedBlock_CountsAndUndoingItTakesItBack()
    {
        await CreateGoalAsync("blocks");
        (await _client.PutAsJsonAsync("/routines/weekdays", new
        {
            name = "Weekdays",
            days = new[] { 0 },
            start = "08:00",
            end = "17:00",
            blocks = new[] { new { id = "csharp", name = "C# study", start = "13:30", end = "15:00", categoryId = "study" } },
        })).EnsureSuccessStatusCode();
        const string path = $"/routines/weekdays/days/{Day}/blocks/csharp";

        (await _client.PutAsJsonAsync(path, new { outcome = "done", at = "14:00" })).EnsureSuccessStatusCode();
        var afterDone = await DoneAsync();
        (await _client.DeleteAsync(path)).EnsureSuccessStatusCode();

        (afterDone, await DoneAsync()).ShouldBe((1, 0));
    }

    [Fact]
    public async Task ACheckedTask_CountsAndUncheckingItTakesItBack()
    {
        await CreateGoalAsync("tasks");
        (await _client.PutAsJsonAsync("/tasks/t1", new { title = "Read", repeat = "daily", categoryId = "study" }))
            .EnsureSuccessStatusCode();

        (await _client.PutAsync($"/tasks/t1/completions/{Day}", null)).EnsureSuccessStatusCode();
        var afterCheck = await DoneAsync();
        (await _client.DeleteAsync($"/tasks/t1/completions/{Day}")).EnsureSuccessStatusCode();

        (afterCheck, await DoneAsync()).ShouldBe((1, 0));
    }

    [Fact]
    public async Task AGoalTrackedByHand_IgnoresCompletions()
    {
        await CreateGoalAsync("manual");
        (await _client.PutAsJsonAsync("/tasks/t1", new { title = "Read", repeat = "daily", categoryId = "study" }))
            .EnsureSuccessStatusCode();

        (await _client.PutAsync($"/tasks/t1/completions/{Day}", null)).EnsureSuccessStatusCode();

        (await DoneAsync()).ShouldBe(0);
    }
}
