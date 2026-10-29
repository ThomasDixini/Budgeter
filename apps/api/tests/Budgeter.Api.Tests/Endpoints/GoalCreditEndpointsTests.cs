using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

/// <summary>Completing blocks over HTTP moves the frequency goals of their category; tasks do not.</summary>
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
        (await _client.PutAsJsonAsync("/routines/weekdays", new
        {
            name = "Weekdays",
            days = new[] { 2 },
            start = "08:00",
            end = "17:00",
            blocks = new[]
            {
                new { id = "csharp", name = "C# study", start = "13:00", end = "14:00", categoryId = "study" },
                new { id = "linq", name = "LINQ", start = "14:00", end = "15:00", categoryId = "study" },
            },
        })).EnsureSuccessStatusCode();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _factory.Dispose();

    private async Task CreateGoalAsync(string period, int target)
    {
        (await _client.PostAsJsonAsync($"/goals?date={Day}", new
        {
            id = "g1",
            categoryId = "study",
            title = "Study",
            type = "frequency",
            period,
            target,
        })).EnsureSuccessStatusCode();
    }

    private async Task CompleteAsync(string blockId, string day = Day) =>
        (await _client.PutAsJsonAsync($"/routines/weekdays/days/{day}/blocks/{blockId}", new { outcome = "done", at = "14:00" }))
            .EnsureSuccessStatusCode();

    private async Task<int> DoneAsync(string day = Day) =>
        (await _client.GetFromJsonAsync<JsonArray>($"/goals?date={day}"))!.Single()!["done"]!.GetValue<int>();

    [Fact]
    public async Task ACompletedBlock_CountsAndUndoingItTakesItBack()
    {
        await CreateGoalAsync("weekly", 5);

        await CompleteAsync("csharp");
        var afterDone = await DoneAsync();
        (await _client.DeleteAsync($"/routines/weekdays/days/{Day}/blocks/csharp")).EnsureSuccessStatusCode();

        (afterDone, await DoneAsync()).ShouldBe((1, 0));
    }

    [Fact]
    public async Task ADailyGoal_CountsBeyondItsTarget_AndStartsOverTheNextDay()
    {
        await CreateGoalAsync("daily", 1);

        await CompleteAsync("csharp");
        await CompleteAsync("linq");

        (await DoneAsync(), await DoneAsync("2026-10-29")).ShouldBe((2, 0));
    }

    [Fact]
    public async Task AWeeklyGoal_StartsTheNextWeekAtZero_AndKeepsTheWeekBefore()
    {
        await CreateGoalAsync("weekly", 5);
        await CompleteAsync("csharp");

        (await DoneAsync("2026-11-01"), await DoneAsync("2026-11-02")).ShouldBe((1, 0));
    }

    [Fact]
    public async Task ACheckedTask_DoesNotCount()
    {
        await CreateGoalAsync("weekly", 5);
        (await _client.PutAsJsonAsync("/tasks/t1", new { title = "Read", repeat = "daily", categoryId = "study" }))
            .EnsureSuccessStatusCode();

        (await _client.PutAsync($"/tasks/t1/completions/{Day}", null)).EnsureSuccessStatusCode();

        (await DoneAsync()).ShouldBe(0);
    }
}
