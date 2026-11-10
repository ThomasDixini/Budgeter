using System.Net;
using System.Net.Http.Json;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class IncomeSplitEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public IncomeSplitEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Part(string id, int percent, params string[] categoryIds) =>
        new { id, name = "Fixed costs", percent, color = 1, categoryIds };

    [Fact]
    public async Task Get_AnswersAnEmptyPlanBeforeTheFirstSave()
    {
        var body = await _client.GetStringAsync("/income-split");

        body.ShouldBe("{\"baseIncomeCents\":0,\"parts\":[]}");
    }

    [Fact]
    public async Task Put_ReplacesThePlanAndAnswersWithIt()
    {
        var plan = new { baseIncomeCents = 950000, parts = new[] { Part("fixed", 60, "housing", "food") } };

        var response = await _client.PutAsJsonAsync("/income-split", plan);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await _client.GetStringAsync("/income-split")).ShouldBe(
            "{\"baseIncomeCents\":950000,\"parts\":[{\"id\":\"fixed\",\"name\":\"Fixed costs\",\"percent\":60,\"color\":1,\"categoryIds\":[\"housing\",\"food\"]}]}");
    }

    [Fact]
    public async Task Put_ACategoryInTwoPartsIsBadRequest()
    {
        var plan = new { baseIncomeCents = 0, parts = new[] { Part("a", 50, "food"), Part("b", 50, "food") } };

        var response = await _client.PutAsJsonAsync("/income-split", plan);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("food");
    }

    [Fact]
    public async Task Put_AnUnknownCategoryIsNotFound()
    {
        var plan = new { baseIncomeCents = 0, parts = new[] { Part("a", 50, "travel") } };

        var response = await _client.PutAsJsonAsync("/income-split", plan);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PutCategory_CreatesARenamedCategoryAndRefusesATakenName()
    {
        var created = await _client.PutAsJsonAsync("/finance-categories/courses", new { name = "Courses" });
        var renamed = await _client.PutAsJsonAsync("/finance-categories/courses", new { name = "Study" });
        var taken = await _client.PutAsJsonAsync("/finance-categories/meals", new { name = "food" });

        (created.StatusCode, renamed.StatusCode, taken.StatusCode)
            .ShouldBe((HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.Conflict));
        var categories = await _client.GetFromJsonAsync<FinanceCategoryResponse[]>("/finance-categories");
        categories!.ShouldContain(category => category.Id == "courses" && category.Name == "Study");
    }

    [Fact]
    public async Task DeleteCategory_KeepsOneWithTransactionsAndRemovesAnUnusedOne()
    {
        (await _client.PutAsJsonAsync(
            "/transactions/tx1",
            new { date = "2026-11-02", description = "Lunch", categoryId = "food", accountId = "checking-account", amountCents = -2500 }))
            .EnsureSuccessStatusCode();

        var used = await _client.DeleteAsync("/finance-categories/food");
        var unused = await _client.DeleteAsync("/finance-categories/other");
        var gone = await _client.DeleteAsync("/finance-categories/other");

        (used.StatusCode, unused.StatusCode, gone.StatusCode)
            .ShouldBe((HttpStatusCode.Conflict, HttpStatusCode.NoContent, HttpStatusCode.NoContent));
    }
}
