using System.Net;
using System.Net.Http.Json;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class RoutineEndpointsTests : IDisposable
{
    private static readonly SaveRoutineRequest Weekdays = new(
        "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00",
        [
            new RoutineBlockRequest("work", "Work", "08:00", "12:00"),
            new RoutineBlockRequest("csharp", "C# study", "13:30", "15:00", "languages"),
        ]);

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public RoutineEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Put_SavesRoutineAndListsItWithItsBlockCategories()
    {
        await CreateLanguagesCategoryAsync();

        var response = await _client.PutAsJsonAsync("/routines/weekdays", Weekdays);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var routines = await _client.GetFromJsonAsync<RoutineResponse[]>("/routines");
        var blocks = routines!.Single().Blocks;
        blocks.Select(block => block.CategoryId).ShouldBe([null, "languages"]);
    }

    [Fact]
    public async Task Put_OmitsTheCategoryOfAnUncategorizedBlock()
    {
        await CreateLanguagesCategoryAsync();

        var response = await _client.PutAsJsonAsync("/routines/weekdays", Weekdays);

        (await response.Content.ReadAsStringAsync()).ShouldNotContain("\"categoryId\":null");
    }

    [Fact]
    public async Task Put_TwiceKeepsASingleRoutine()
    {
        await CreateLanguagesCategoryAsync();
        await _client.PutAsJsonAsync("/routines/weekdays", Weekdays);

        await _client.PutAsJsonAsync("/routines/weekdays", Weekdays with { End = "18:00" });

        var routines = await _client.GetFromJsonAsync<RoutineResponse[]>("/routines");
        routines!.Single().End.ShouldBe("18:00");
    }

    [Fact]
    public async Task Put_UnknownCategoryIsNotFoundNamingIt()
    {
        var response = await _client.PutAsJsonAsync("/routines/weekdays", Weekdays);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await response.Content.ReadAsStringAsync()).ShouldContain("languages");
    }

    [Fact]
    public async Task Put_InvalidTimeIsBadRequestNamingTheValue()
    {
        var response = await _client.PutAsJsonAsync("/routines/weekdays", Weekdays with { Start = "8am" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("8am");
    }

    [Fact]
    public async Task Delete_RemovesTheRoutineAndRepeatsAsNoContent()
    {
        await CreateLanguagesCategoryAsync();
        await _client.PutAsJsonAsync("/routines/weekdays", Weekdays);

        var first = await _client.DeleteAsync("/routines/weekdays");
        var retry = await _client.DeleteAsync("/routines/weekdays");

        (first.StatusCode, retry.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await _client.GetFromJsonAsync<RoutineResponse[]>("/routines")).ShouldBeEmpty();
    }

    private async Task CreateLanguagesCategoryAsync()
    {
        var response = await _client.PostAsJsonAsync("/categories",
            new CreateCategoryRequest("languages", "Languages", "#86EFAC"));
        response.EnsureSuccessStatusCode();
    }
}
