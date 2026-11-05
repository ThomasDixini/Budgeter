using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Budgeter.Api.Endpoints;
using Shouldly;

namespace Budgeter.Api.Tests.Endpoints;

public sealed class InvestmentEndpointsTests : IDisposable
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public InvestmentEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object Petr4(long? priceCents = 1200) => new
    {
        name = "PETR4",
        kind = "stock",
        price = priceCents is { } cents ? new { cents, on = "2026-01-06" } : null,
    };

    private static object Trade(string kind = "buy", long quantity = 100_000, string date = "2026-01-02") => new
    {
        investmentId = "petr4",
        date,
        kind,
        quantityThousandths = quantity,
        unitPriceCents = 1000,
    };

    private Task<PortfolioResponse?> PortfolioAsync() =>
        _client.GetFromJsonAsync<PortfolioResponse>("/investments?date=2026-01-06", Json);

    [Fact]
    public async Task Put_SavesTheInvestmentAndThePortfolioValuesIt()
    {
        (await _client.PutAsJsonAsync("/investments/petr4", Petr4())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-trades/t1", Trade())).EnsureSuccessStatusCode();

        var portfolio = (await PortfolioAsync())!;

        var line = portfolio.Lines.Single();
        (line.Investment.Name, line.CostCents, line.ValueCents, line.GainCents).ShouldBe(("PETR4", 100_000L, 120_000L, 20_000L));
        (portfolio.Performance!.GainPercent, portfolio.Performance.CdiGainCents, portfolio.Performance.CdiThrough)
            .ShouldBe((20m, 0L, null));
        portfolio.Trades.Single().Id.ShouldBe("t1");
    }

    [Fact]
    public async Task Put_ATradeOfAnUnknownInvestmentIsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/investment-trades/t1", Trade());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_SellingMoreThanWasHeldIsBadRequest()
    {
        (await _client.PutAsJsonAsync("/investments/petr4", Petr4())).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync("/investment-trades/t1", Trade(kind: "sell"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_IncomeIsListedAndCounted()
    {
        (await _client.PutAsJsonAsync("/investments/petr4", Petr4())).EnsureSuccessStatusCode();

        var response = await _client.PutAsJsonAsync(
            "/investment-incomes/i1",
            new { investmentId = "petr4", date = "2026-01-05", kind = "dividend", amountCents = 1000 });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var portfolio = (await PortfolioAsync())!;
        (portfolio.Incomes.Single().AmountCents, portfolio.Totals.IncomeCents).ShouldBe((1000L, 1000L));
    }

    [Fact]
    public async Task Delete_AnInvestmentWithHistoryIsConflictUntilItsTradesAreGone()
    {
        (await _client.PutAsJsonAsync("/investments/petr4", Petr4())).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/investment-trades/t1", Trade())).EnsureSuccessStatusCode();

        var kept = await _client.DeleteAsync("/investments/petr4");
        (await _client.DeleteAsync("/investment-trades/t1")).EnsureSuccessStatusCode();
        var removed = await _client.DeleteAsync("/investments/petr4");

        (kept.StatusCode, removed.StatusCode).ShouldBe((HttpStatusCode.Conflict, HttpStatusCode.NoContent));
        (await PortfolioAsync())!.Lines.ShouldBeEmpty();
    }

    [Fact]
    public async Task Get_WithoutAValidDateIsBadRequest()
    {
        var response = await _client.GetAsync("/investments?date=today");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
