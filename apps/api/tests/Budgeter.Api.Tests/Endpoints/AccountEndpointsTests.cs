using System.Net;
using System.Net.Http.Json;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class AccountEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public AccountEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Visa(int closingDay = 3) => new
    {
        name = "Visa",
        kind = "creditCard",
        card = new { limitCents = 1200000, closingDay, dueDay = 10 },
    };

    private Task<HttpResponseMessage> SpendAsync(string accountId, string date, long amountCents) =>
        _client.PutAsJsonAsync(
            $"/transactions/{Guid.NewGuid()}",
            new { date, description = "Purchase", categoryId = "food", accountId, amountCents });

    [Fact]
    public async Task GetAccounts_SpellsTheKindAndTermsAsTheWebApp()
    {
        var body = await _client.GetStringAsync("/accounts");

        body.ShouldContain("\"kind\":\"bankAccount\",\"openingBalanceCents\":0}");
        body.ShouldContain("\"kind\":\"creditCard\",\"openingBalanceCents\":0,\"card\":{\"limitCents\":500000,\"closingDay\":3,\"dueDay\":10}");
    }

    [Fact]
    public async Task Put_CreatesAnAccountAtTheEndOfTheList()
    {
        var response = await _client.PutAsJsonAsync("/accounts/visa", Visa());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var accounts = await _client.GetStringAsync("/accounts");
        accounts.ShouldEndWith(
            "{\"id\":\"visa\",\"name\":\"Visa\",\"kind\":\"creditCard\",\"openingBalanceCents\":0,\"card\":{\"limitCents\":1200000,\"closingDay\":3,\"dueDay\":10}}]");
    }

    [Fact]
    public async Task Put_ADayOutOfRangeIsBadRequest()
    {
        var response = await _client.PutAsJsonAsync("/accounts/visa", Visa(closingDay: 32));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("received 32");
    }

    [Fact]
    public async Task Put_ChangingTheKindIsConflict()
    {
        var response = await _client.PutAsJsonAsync("/accounts/checking-account", Visa());

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Delete_AnAccountWithTransactionsIsConflict_AndAnUnusedOneIsRemoved()
    {
        (await SpendAsync("checking-account", "2026-11-02", -1000)).EnsureSuccessStatusCode();

        var used = await _client.DeleteAsync("/accounts/checking-account");
        var unused = await _client.DeleteAsync("/accounts/credit-card");

        (used.StatusCode, unused.StatusCode).ShouldBe((HttpStatusCode.Conflict, HttpStatusCode.NoContent));
    }

    [Fact]
    public async Task GetStatements_ReportBalancesAndTheCardsInvoices()
    {
        (await SpendAsync("checking-account", "2026-11-01", 950000)).EnsureSuccessStatusCode();
        (await SpendAsync("credit-card", "2026-10-20", -28640)).EnsureSuccessStatusCode();

        var statements = await _client.GetFromJsonAsync<AccountStatementResponse[]>("/account-statements?date=2026-11-02");

        var (checking, card) = (statements![0], statements[1]);
        (checking.BalanceCents, card.BalanceCents).ShouldBe((950000L, -28640L));
        (card.Card!.OpenInvoice.AmountCents, card.Card.OpenInvoice.DueOn).ShouldBe((28640L, new DateOnly(2026, 11, 10)));
    }

    [Theory]
    [InlineData("/account-statements")]
    [InlineData("/account-statements?date=someday")]
    public async Task GetStatements_WithoutAValidDateIsBadRequest(string url)
    {
        var response = await _client.GetAsync(url);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
