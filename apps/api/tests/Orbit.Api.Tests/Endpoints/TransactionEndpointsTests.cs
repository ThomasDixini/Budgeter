using System.Net;
using System.Net.Http.Json;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class TransactionEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public TransactionEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Groceries(long amountCents = -28640, string categoryId = "food") => new
    {
        date = "2026-10-31",
        description = "Groceries",
        categoryId,
        accountId = "credit-card",
        amountCents,
    };

    [Fact]
    public async Task Put_SavesTheTransactionAndAnswersWithIt()
    {
        var response = await _client.PutAsJsonAsync("/transactions/tx1", Groceries());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("\"amountCents\":-28640");
        body.ShouldContain("\"date\":\"2026-10-31\"");
    }

    [Fact]
    public async Task Put_AZeroAmountIsBadRequest()
    {
        var response = await _client.PutAsJsonAsync("/transactions/tx1", Groceries(amountCents: 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_AFractionalAmountIsBadRequest()
    {
        var body = new { date = "2026-10-31", description = "Groceries", categoryId = "food", accountId = "credit-card", amountCents = 286.4 };

        var response = await _client.PutAsJsonAsync("/transactions/tx1", body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_AnUnknownCategoryIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/transactions/tx1", Groceries(categoryId: "travel"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_ListsTheTransactionsOfTheMonth()
    {
        (await _client.PutAsJsonAsync("/transactions/tx1", Groceries())).EnsureSuccessStatusCode();

        var october = await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-10");
        var november = await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-11");

        (october!.Single().Id, november!.Length).ShouldBe(("tx1", 0));
    }

    [Theory]
    [InlineData("/transactions?month=2026-13")]
    [InlineData("/transactions")]
    public async Task Get_WithoutAValidMonthIsBadRequest(string url)
    {
        var response = await _client.GetAsync(url);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_RemovesTheTransactionAndToleratesOneAlreadyGone()
    {
        (await _client.PutAsJsonAsync("/transactions/tx1", Groceries())).EnsureSuccessStatusCode();

        var first = await _client.DeleteAsync("/transactions/tx1");
        var second = await _client.DeleteAsync("/transactions/tx1");

        (first.StatusCode, second.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-10")).ShouldBeEmpty();
    }

    [Fact]
    public async Task GetAccounts_SpellsTheKindAsTheWebApp()
    {
        var body = await _client.GetStringAsync("/accounts");

        body.ShouldContain("\"kind\":\"bankAccount\"");
        body.ShouldContain("\"kind\":\"creditCard\"");
    }

    [Fact]
    public async Task GetFinanceCategories_ListsTheStarterSet()
    {
        var categories = await _client.GetFromJsonAsync<FinanceCategoryResponse[]>("/finance-categories");

        categories!.ShouldContain(category => category.Id == "food" && category.Name == "Food");
    }
}
