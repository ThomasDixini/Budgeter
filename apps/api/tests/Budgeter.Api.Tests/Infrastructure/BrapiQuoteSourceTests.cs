using System.Net;
using System.Text.Json;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Infrastructure.Quotes;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public class BrapiQuoteSourceTests
{
    // Trading days stamped at 03:00 UTC: Jan 2 and Jan 30, then Feb 2 (2026).
    private const string Answer = """
        {"results":[{"symbol":"PETR4","historicalDataPrice":[
        {"date":1767322800,"close":37.76},{"date":1769742000,"close":38.451},
        {"date":1770001200,"close":39.33},{"date":1770087600,"close":null}]}]}
        """;

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public List<string> Requested { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requested.Add(request.RequestUri!.PathAndQuery);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
        }
    }

    private static BrapiQuoteSource SourceOver(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://example.test/") });

    [Fact]
    public async Task Fetch_AsksTheDailyHistoryOfTheSymbolBetweenTheDates()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Answer);

        await SourceOver(handler).FetchMonthEndsAsync("PETR4", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 28), CancellationToken.None);

        handler.Requested.ShouldBe(["/api/quote/PETR4?interval=1d&startDate=2026-01-01&endDate=2026-02-28"]);
    }

    [Fact]
    public async Task Fetch_ReadsALongSpanInWindowsOfNinetyDays()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Answer);

        await SourceOver(handler).FetchMonthEndsAsync("PETR4", new DateOnly(2026, 1, 1), new DateOnly(2026, 7, 1), CancellationToken.None);

        handler.Requested.ShouldBe([
            "/api/quote/PETR4?interval=1d&startDate=2026-01-01&endDate=2026-04-01",
            "/api/quote/PETR4?interval=1d&startDate=2026-04-02&endDate=2026-07-01",
        ]);
    }

    [Fact]
    public async Task Fetch_KeepsTheLastCloseOfEachMonthInCents()
    {
        var prices = await SourceOver(new StubHandler(HttpStatusCode.OK, Answer))
            .FetchMonthEndsAsync("PETR4", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 28), CancellationToken.None);

        prices.ShouldBe([new MonthEndPrice("PETR4", "2026-01", 3845), new MonthEndPrice("PETR4", "2026-02", 3933)]);
    }

    [Fact]
    public async Task Fetch_AnUnknownSymbolHasNoPrices()
    {
        var prices = await SourceOver(new StubHandler(HttpStatusCode.NotFound, "{}"))
            .FetchMonthEndsAsync("XXXX3", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 28), CancellationToken.None);

        prices.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.BadRequest)]
    public async Task Fetch_ARefusedRequestFails(HttpStatusCode status)
    {
        var source = SourceOver(new StubHandler(status, """{"error":true,"code":"INVALID_TOKEN"}"""));

        await Should.ThrowAsync<HttpRequestException>(() =>
            source.FetchMonthEndsAsync("PETR4", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 28), CancellationToken.None));
    }

    [Fact]
    public void ParseDays_AnAnswerForAnotherSymbolHasNoDays()
    {
        BrapiQuoteSource.ParseDays("CVBI11", JsonDocument.Parse(Answer)).ShouldBeEmpty();
    }

    [Fact]
    public void ParseDays_AnAnswerWithoutHistoryHasNoDays()
    {
        var none = JsonDocument.Parse("""{"results":[{"symbol":"PETR4","regularMarketPrice":45.3}]}""");

        BrapiQuoteSource.ParseDays("PETR4", none).ShouldBeEmpty();
    }

    [Fact]
    public async Task FetchLatest_ReadsThePriceAndTheDayOfTheLastTrade()
    {
        var answer = """{"results":[{"symbol":"TOTS3","regularMarketPrice":33.14,"regularMarketTime":"2026-11-07T21:32:40.000Z"}]}""";
        var handler = new StubHandler(HttpStatusCode.OK, answer);

        var quote = await SourceOver(handler).FetchLatestAsync("TOTS3", CancellationToken.None);

        quote.ShouldBe(new LatestQuote("TOTS3", 3314, new DateOnly(2026, 11, 7)));
        handler.Requested.ShouldBe(["/api/quote/TOTS3"]);
    }

    [Fact]
    public async Task FetchLatest_AnUnknownSymbolHasNoQuote()
    {
        var quote = await SourceOver(new StubHandler(HttpStatusCode.NotFound, "{}")).FetchLatestAsync("XXXX3", CancellationToken.None);

        quote.ShouldBeNull();
    }

    [Fact]
    public async Task FetchLatest_ARefusedRequestFails()
    {
        var source = SourceOver(new StubHandler(HttpStatusCode.Unauthorized, "{}"));

        await Should.ThrowAsync<HttpRequestException>(() => source.FetchLatestAsync("TOTS3", CancellationToken.None));
    }

    [Fact]
    public void ParseLatest_AnAnswerForAnotherSymbolOrWithoutAPriceHasNoQuote()
    {
        var other = JsonDocument.Parse("""{"results":[{"symbol":"PCIP11","regularMarketPrice":90.1,"regularMarketTime":"2026-11-07T21:32:40.000Z"}]}""");
        var noPrice = JsonDocument.Parse("""{"results":[{"symbol":"CVBI11","regularMarketTime":"2026-11-07T21:32:40.000Z"}]}""");

        BrapiQuoteSource.ParseLatest("CVBI11", other).ShouldBeNull();
        BrapiQuoteSource.ParseLatest("CVBI11", noPrice).ShouldBeNull();
    }
}
