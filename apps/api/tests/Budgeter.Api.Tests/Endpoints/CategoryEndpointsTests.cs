using System.Net;
using System.Net.Http.Json;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class CategoryEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public CategoryEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Post_CreatesCategoryAndListsIt()
    {
        var response = await _client.PostAsJsonAsync("/categories",
            new CreateCategoryRequest("languages", "Languages", "#86efac"));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var categories = await _client.GetFromJsonAsync<CategoryResponse[]>("/categories");
        categories.ShouldBe([new CategoryResponse("languages", "Languages", "#86EFAC")]);
    }

    [Fact]
    public async Task Post_RetryReturnsOkWithStoredCategory()
    {
        var request = new CreateCategoryRequest("languages", "Languages", "#86EFAC");
        await _client.PostAsJsonAsync("/categories", request);

        var retry = await _client.PostAsJsonAsync("/categories", request);

        retry.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await _client.GetFromJsonAsync<CategoryResponse[]>("/categories"))!.Length.ShouldBe(1);
    }

    [Fact]
    public async Task Post_InvalidColorIsBadRequestNamingTheValue()
    {
        var response = await _client.PostAsJsonAsync("/categories",
            new CreateCategoryRequest("languages", "Languages", "blue"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("blue");
    }

    [Fact]
    public async Task Post_MissingNameIsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/categories", new { id = "languages", color = "#86EFAC" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_UpdatesTheCategory()
    {
        await _client.PostAsJsonAsync("/categories", new CreateCategoryRequest("languages", "Languages", "#86EFAC"));

        var response = await _client.PutAsJsonAsync("/categories/languages", new UpdateCategoryRequest("Spanish", "#7DD3FC"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var categories = await _client.GetFromJsonAsync<CategoryResponse[]>("/categories");
        categories.ShouldBe([new CategoryResponse("languages", "Spanish", "#7DD3FC")]);
    }

    [Fact]
    public async Task Put_UnknownCategoryIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/categories/missing", new UpdateCategoryRequest("Spanish", "#7DD3FC"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_RemovesTheCategoryAndRetriesSucceed()
    {
        await _client.PostAsJsonAsync("/categories", new CreateCategoryRequest("languages", "Languages", "#86EFAC"));

        var first = await _client.DeleteAsync("/categories/languages");
        var retry = await _client.DeleteAsync("/categories/languages");

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        retry.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await _client.GetFromJsonAsync<CategoryResponse[]>("/categories"))!.ShouldBeEmpty();
    }
}
