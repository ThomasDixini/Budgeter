using System.Net;
using System.Net.Http.Json;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class CardPaymentEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public CardPaymentEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object PayCard(string cardId = "credit-card", long amountCents = 28640) => new
    {
        cardId,
        fromAccountId = "checking-account",
        date = "2026-11-10",
        amountCents,
    };

    [Fact]
    public async Task Put_SavesThePaymentAndListsItInItsMonth()
    {
        var response = await _client.PutAsJsonAsync("/card-payments/p1", PayCard());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var november = await _client.GetFromJsonAsync<CardPaymentResponse[]>("/card-payments?month=2026-11");
        november!.Single().ShouldBe(new CardPaymentResponse("p1", "credit-card", "checking-account", new DateOnly(2026, 11, 10), 28640));
    }

    [Fact]
    public async Task Put_PayingABankAccountIsBadRequest()
    {
        var response = await _client.PutAsJsonAsync("/card-payments/p1", PayCard(cardId: "checking-account"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_AnUnknownCardIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/card-payments/p1", PayCard(cardId: "amex"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_AZeroAmountIsBadRequest()
    {
        var response = await _client.PutAsJsonAsync("/card-payments/p1", PayCard(amountCents: 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_RemovesThePaymentAndToleratesOneAlreadyGone()
    {
        (await _client.PutAsJsonAsync("/card-payments/p1", PayCard())).EnsureSuccessStatusCode();

        var first = await _client.DeleteAsync("/card-payments/p1");
        var second = await _client.DeleteAsync("/card-payments/p1");

        (first.StatusCode, second.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await _client.GetFromJsonAsync<CardPaymentResponse[]>("/card-payments?month=2026-11")).ShouldBeEmpty();
    }

    [Fact]
    public async Task Get_WithoutAValidMonthIsBadRequest()
    {
        var response = await _client.GetAsync("/card-payments?month=2026-1");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
