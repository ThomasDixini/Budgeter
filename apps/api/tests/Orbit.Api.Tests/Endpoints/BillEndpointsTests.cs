using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class BillEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public BillEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Rent(object? recurrence = null, long amountCents = 150000) => new
    {
        kind = "payable",
        description = "Rent",
        categoryId = "housing",
        amountCents,
        dueDate = "2026-11-05",
        recurrence,
    };

    private Task<BillsAgendaResponse?> AgendaAsync() =>
        _client.GetFromJsonAsync<BillsAgendaResponse>("/bills?date=2026-11-03", Json);

    [Fact]
    public async Task Put_SavesTheBillAndTheAgendaListsIt()
    {
        var response = await _client.PutAsJsonAsync("/bills/b1", Rent());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var bill = (await AgendaAsync())!.Bills.Single();
        (bill.Id, bill.Kind.ToString(), bill.AmountCents, bill.Settlement).ShouldBe(("b1", "Payable", 150000L, null));
    }

    [Fact]
    public async Task Put_ARecurrenceCreatesEveryOccurrence()
    {
        var response = await _client.PutAsJsonAsync("/bills/b1", Rent(new { kind = "installments", count = 3 }));

        var saved = await response.Content.ReadFromJsonAsync<BillResponse[]>(Json);
        saved!.Select(bill => bill.Series!.Number).ShouldBe([1, 2, 3]);
    }

    [Fact]
    public async Task Put_AnUnknownCategoryIsNotFoundAndAZeroAmountIsBadRequest()
    {
        var unknown = await _client.PutAsJsonAsync("/bills/b1", new { kind = "payable", description = "Rent", categoryId = "nope", amountCents = 100, dueDate = "2026-11-05" });
        var zero = await _client.PutAsJsonAsync("/bills/b1", Rent(amountCents: 0));

        (unknown.StatusCode, zero.StatusCode).ShouldBe((HttpStatusCode.NotFound, HttpStatusCode.BadRequest));
    }

    [Fact]
    public async Task SettlementPut_MovesTheBillToSettledAndCreatesTheTransaction()
    {
        (await _client.PutAsJsonAsync("/bills/b1", Rent())).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/bills/b1/settlement", new { date = "2026-11-03", accountId = "checking-account" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var transactions = await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-11");
        transactions!.Single().AmountCents.ShouldBe(-150000);
        (await AgendaAsync())!.Bills.Single().Settlement!.AccountId.ShouldBe("checking-account");
    }

    [Fact]
    public async Task SettlementDelete_ReopensTheBillAndRemovesTheTransaction()
    {
        (await _client.PutAsJsonAsync("/bills/b1", Rent())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/bills/b1/settlement", new { date = "2026-11-03", accountId = "checking-account" })).EnsureSuccessStatusCode();

        var response = await _client.DeleteAsync("/bills/b1/settlement");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await _client.GetFromJsonAsync<TransactionResponse[]>("/transactions?month=2026-11")).ShouldBeEmpty();
    }

    [Fact]
    public async Task Put_EditingASettledBillIsConflict()
    {
        (await _client.PutAsJsonAsync("/bills/b1", Rent())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/bills/b1/settlement", new { date = "2026-11-03", accountId = "checking-account" })).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/bills/b1", Rent(amountCents: 1));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Delete_RemovesTheBillAndToleratesOneAlreadyGone()
    {
        (await _client.PutAsJsonAsync("/bills/b1", Rent())).EnsureSuccessStatusCode();

        var first = await _client.DeleteAsync("/bills/b1");
        var second = await _client.DeleteAsync("/bills/b1");

        (first.StatusCode, second.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await AgendaAsync())!.Bills.ShouldBeEmpty();
    }

    [Fact]
    public async Task Get_WithoutAValidDateIsBadRequest()
    {
        var response = await _client.GetAsync("/bills?date=soon");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
