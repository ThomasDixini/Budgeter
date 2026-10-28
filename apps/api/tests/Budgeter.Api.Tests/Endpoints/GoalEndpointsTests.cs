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
        var goal = (await _client.GetFromJsonAsync<JsonArray>("/goals?date=2026-10-28"))!.Single()!;
        goal["type"]!.GetValue<string>().ShouldBe("objective");
        goal["period"]!.GetValue<string>().ShouldBe("custom");
        goal["deadline"]!.GetValue<string>().ShouldBe("2026-12-15");
        goal["done"]!.GetValue<int>().ShouldBe(0);
    }

    [Fact]
    public async Task Post_OmitsAbsentOptionalFields()
    {
        await PostGoalAsync(WeeklyGoal("g1"));

        var goal = (await _client.GetFromJsonAsync<JsonArray>("/goals?date=2026-10-28"))!.Single()!.AsObject();

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
    public async Task Get_WithoutADateIsBadRequest()
    {
        var response = await _client.GetAsync("/goals");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostProgress_AddsOneAndRepeatingTheEntryCountsOnce()
    {
        await PostGoalAsync(WeeklyGoal("g1"));
        var entry = new { eventId = "e1", date = "2026-10-28", amount = 1 };

        await _client.PostAsJsonAsync("/goals/g1/progress", entry);
        var response = await _client.PostAsJsonAsync("/goals/g1/progress", entry);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonObject>())!["done"]!.GetValue<int>().ShouldBe(1);
    }

    [Fact]
    public async Task PostProgress_TakesOneBackWithANegativeAmount()
    {
        await PostGoalAsync(WeeklyGoal("g1"));
        await _client.PostAsJsonAsync("/goals/g1/progress", new { eventId = "e1", date = "2026-10-28", amount = 1 });

        var response = await _client.PostAsJsonAsync(
            "/goals/g1/progress", new { eventId = "e2", date = "2026-10-28", amount = -1 });

        (await response.Content.ReadFromJsonAsync<JsonObject>())!["done"]!.GetValue<int>().ShouldBe(0);
    }

    [Fact]
    public async Task Goals_StartTheNextWeekAtZero()
    {
        await PostGoalAsync(WeeklyGoal("g1"));
        await _client.PostAsJsonAsync("/goals/g1/progress", new { eventId = "e1", date = "2026-10-28", amount = 1 });

        var thisWeek = (await _client.GetFromJsonAsync<JsonArray>("/goals?date=2026-11-01"))!.Single()!;
        var nextWeek = (await _client.GetFromJsonAsync<JsonArray>("/goals?date=2026-11-02"))!.Single()!;

        (thisWeek["done"]!.GetValue<int>(), nextWeek["done"]!.GetValue<int>()).ShouldBe((1, 0));
    }

    [Fact]
    public async Task PostProgress_PastTheTargetIsIgnored()
    {
        await PostGoalAsync(new
        {
            id = "g1",
            categoryId = "study",
            title = "Study once",
            type = "frequency",
            period = "weekly",
            target = 1,
        });
        await _client.PostAsJsonAsync("/goals/g1/progress", new { eventId = "e1", date = "2026-10-28", amount = 1 });

        var response = await _client.PostAsJsonAsync(
            "/goals/g1/progress", new { eventId = "e2", date = "2026-10-28", amount = 1 });
        var back = await _client.PostAsJsonAsync(
            "/goals/g1/progress", new { eventId = "e3", date = "2026-10-28", amount = -1 });

        (await response.Content.ReadFromJsonAsync<JsonObject>())!["done"]!.GetValue<int>().ShouldBe(1);
        (await back.Content.ReadFromJsonAsync<JsonObject>())!["done"]!.GetValue<int>().ShouldBe(0);
    }

    [Fact]
    public async Task PostProgress_UnknownGoalIsNotFound()
    {
        var response = await _client.PostAsJsonAsync(
            "/goals/missing/progress", new { eventId = "e1", date = "2026-10-28", amount = 1 });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_EditsTheGoalButNotItsTypeOrCategory()
    {
        await PostGoalAsync(WeeklyGoal("g1"));

        var response = await _client.PutAsJsonAsync("/goals/g1?date=2026-10-28", new
        {
            title = "Study C# 3x a week",
            period = "monthly",
            target = 3,
            tracking = "blocks",
            type = "objective",
            categoryId = "other",
        });

        var goal = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        (goal["title"]!.GetValue<string>(), goal["period"]!.GetValue<string>(), goal["target"]!.GetValue<int>(),
            goal["tracking"]!.GetValue<string>(), goal["type"]!.GetValue<string>(), goal["categoryId"]!.GetValue<string>())
            .ShouldBe(("Study C# 3x a week", "monthly", 3, "blocks", "frequency", "study"));
    }

    [Fact]
    public async Task Put_BrokenRuleIsBadRequestAndUnknownGoalIsNotFound()
    {
        await PostGoalAsync(WeeklyGoal("g1"));
        var edit = new { title = "Study", period = "weekly", target = 0 };

        var broken = await _client.PutAsJsonAsync("/goals/g1?date=2026-10-28", edit);
        var unknown = await _client.PutAsJsonAsync("/goals/missing?date=2026-10-28", edit with { target = 3 });

        (broken.StatusCode, unknown.StatusCode).ShouldBe((HttpStatusCode.BadRequest, HttpStatusCode.NotFound));
    }

    [Theory]
    [InlineData("tracking", 7)]
    [InlineData("period", 9)]
    public async Task Post_RejectsANumberWhereAnEnumNameIsExpected(string field, int number)
    {
        var body = new System.Text.Json.Nodes.JsonObject
        {
            ["id"] = "g1",
            ["categoryId"] = "study",
            ["title"] = "Study",
            ["type"] = "frequency",
            ["period"] = "weekly",
            ["target"] = 5,
        };
        body[field] = number;

        var response = await _client.PostAsJsonAsync("/goals?date=2026-10-28", body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_RemovesTheGoalAndRepeatsAsNoContent()
    {
        await PostGoalAsync(WeeklyGoal("g1"));

        var first = await _client.DeleteAsync("/goals/g1");
        var retry = await _client.DeleteAsync("/goals/g1");

        (first.StatusCode, retry.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await _client.GetFromJsonAsync<JsonArray>("/goals?date=2026-10-28"))!.ShouldBeEmpty();
    }

    private Task<HttpResponseMessage> PostGoalAsync(object body) => _client.PostAsJsonAsync("/goals?date=2026-10-28", body);

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
