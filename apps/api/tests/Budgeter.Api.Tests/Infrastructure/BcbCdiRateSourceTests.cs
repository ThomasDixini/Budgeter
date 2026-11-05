using System.Net;
using System.Text.Json;
using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Infrastructure.Cdi;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public class BcbCdiRateSourceTests
{
    private const string Answer = """[{"data":"02/01/2026","valor":"0.054266"},{"data":"05/01/2026","valor":"0.054266"}]""";

    /// <summary>Answers every request with a fixed body and remembers the addresses asked.</summary>
    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public List<string> Requested { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requested.Add(request.RequestUri!.PathAndQuery);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
        }
    }

    private static BcbCdiRateSource SourceOver(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://example.test/") });

    [Fact]
    public async Task Fetch_AsksTheDailySeriesForTheDatesAndReadsTheRates()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Answer);

        var rates = await SourceOver(handler).FetchAsync(new DateOnly(2026, 1, 2), new DateOnly(2026, 1, 5), CancellationToken.None);

        rates.ShouldBe([new CdiRate(new DateOnly(2026, 1, 2), 0.054266m), new CdiRate(new DateOnly(2026, 1, 5), 0.054266m)]);
        handler.Requested.ShouldBe(["/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=02/01/2026&dataFinal=05/01/2026"]);
    }

    [Fact]
    public async Task Fetch_ReadsALongSpanInWindowsOfTenYears()
    {
        var handler = new StubHandler(HttpStatusCode.OK, "[]");

        await SourceOver(handler).FetchAsync(new DateOnly(2010, 1, 1), new DateOnly(2026, 1, 5), CancellationToken.None);

        handler.Requested.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Fetch_AFailedAnswerIsAnHttpError()
    {
        var handler = new StubHandler(HttpStatusCode.ServiceUnavailable, "down");

        await Should.ThrowAsync<HttpRequestException>(() =>
            SourceOver(handler).FetchAsync(new DateOnly(2026, 1, 2), new DateOnly(2026, 1, 5), CancellationToken.None));
    }

    [Fact]
    public void ParseRates_RejectsAnAnswerThatIsNotAList()
    {
        var exception = Should.Throw<FormatException>(() => BcbCdiRateSource.ParseRates(JsonDocument.Parse("""{"erro":"x"}""")));

        exception.Message.ShouldContain("Object");
    }
}
