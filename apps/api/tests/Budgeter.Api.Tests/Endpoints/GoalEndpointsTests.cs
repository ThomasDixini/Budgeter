using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class GoalEndpointsTests : IAsyncLifetime, IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public GoalEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        var response = await _client.PostAsJsonAsync("/categories",
            new CreateCategoryRequest("study", "Study", "#7DD3FC"));
        response.EnsureSuccessStatusCode();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Post_CreatesObjectiveSpelledLikeTheWebApp()
    {
        var response = await PostGoalAsync(new
        {
            id = "g2",
            categoryId = "study",
            title = "Finish the course",
            type = "objective",
            period = "custom",
            target = 12,
            unit = "modules",
            deadline = "2026-12-15",
        });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var goal = (await _client.GetFromJsonAsync<JsonArray>("/goals"))!.Single()!;
        goal["type"]!.GetValue<string>().ShouldBe("objective");
        goal["period"]!.GetValue<string>().ShouldBe("custom");
        goal["deadline"]!.GetValue<string>().ShouldBe("2026-12-15");
        goal["done"]!.GetValue<int>().ShouldBe(0);
    }

    [Fact]
    public async Task Post_OmitsAbsentOptionalFields()
    {
        await PostGoalAsync(WeeklyGoal("g1"));

        var goal = (await _client.GetFromJsonAsync<JsonArray>("/goals"))!.Single()!.AsObject();

        goal.ContainsKey("unit").ShouldBeFalse();
        goal.ContainsKey("deadline").ShouldBeFalse();
    }

    [Fact]
    public async Task Post_UnknownCategoryIsNotFound()
    {
        var response = await PostGoalAsync(WeeklyGoal("g1", categoryId: "missing"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Post_BrokenRuleIsBadRequest()
    {
        var response = await PostGoalAsync(new
        {
            id = "g1",
            categoryId = "study",
            title = "Read",
            type = "frequency",
            period = "custom",
            target = 3,
        });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostProgress_IncrementsAndReturnsTheGoal()
    {
        await PostGoalAsync(WeeklyGoal("g1"));

        var response = await _client.PostAsync("/goals/g1/progress", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonObject>())!["done"]!.GetValue<int>().ShouldBe(1);
    }

    [Fact]
    public async Task PostProgress_UnknownGoalIsNotFound()
    {
        var response = await _client.PostAsync("/goals/missing/progress", content: null);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private Task<HttpResponseMessage> PostGoalAsync(object body) => _client.PostAsJsonAsync("/goals", body);

    private static object WeeklyGoal(string id, string categoryId = "study") => new
    {
        id,
        categoryId,
        title = "Study C# 5x a week",
        type = "frequency",
        period = "weekly",
        target = 5,
    };
}
