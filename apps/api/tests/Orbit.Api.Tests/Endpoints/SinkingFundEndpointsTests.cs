using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Orbit.Api.Endpoints;
using Shouldly;

namespace Orbit.Api.Tests.Endpoints;

public sealed class SinkingFundEndpointsTests : IDisposable
{
    private const string Today = "2026-11-11";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public SinkingFundEndpointsTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose() => _factory.Dispose();

    private static object EveryMonths(int intervalMonths = 3, string nextDueDate = "2026-12-11", string categoryId = "housing") => new
    {
        description = "Insurance",
        categoryId,
        amountCents = 30000,
        schedule = new { kind = "everyMonths", intervalMonths, nextDueDate },
    };

    private static object FixedDate() => new
    {
        description = "Property tax",
        categoryId = "housing",
        amountCents = 120000,
        schedule = new { kind = "fixedDate", month = 1, day = 15 },
    };

    private Task<HttpResponseMessage> PutAsync(string id, object body) =>
        _client.PutAsJsonAsync($"/sinking-funds/{id}?today={Today}", body);

    private Task<SinkingFundsResponse?> ListAsync() =>
        _client.GetFromJsonAsync<SinkingFundsResponse>($"/sinking-funds?today={Today}", Json);

    [Fact]
    public async Task Put_EveryMonthsReturnsTheFundWithItsCalculations()
    {
        var response = await PutAsync("f1", EveryMonths());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var schedule = document.RootElement.GetProperty("schedule");
        (schedule.GetProperty("kind").GetString(), schedule.GetProperty("intervalMonths").GetInt32(),
            schedule.GetProperty("day").GetInt32(), schedule.GetProperty("nextDueDate").GetString(),
            schedule.TryGetProperty("month", out _))
            .ShouldBe(("everyMonths", 3, 11, "2026-12-11", false));
        (document.RootElement.GetProperty("monthlyCents").GetInt64(), document.RootElement.GetProperty("savedCents").GetInt64(),
            document.RootElement.GetProperty("cycleStart").GetString())
            .ShouldBe((10000L, 20000L, "2026-09-11"));
    }

    [Fact]
    public async Task Put_FixedDateReturnsTheNextOccurrenceAndAYearlyCycle()
    {
        var response = await PutAsync("f1", FixedDate());

        var fund = await response.Content.ReadFromJsonAsync<SinkingFundResponse>(Json);
        (fund!.Schedule.Kind.ToString(), fund.Schedule.IntervalMonths, fund.Schedule.Month, fund.Schedule.Day,
            fund.Schedule.NextDueDate.ToString("yyyy-MM-dd"), fund.MonthlyCents, fund.SavedCents)
            .ShouldBe(("FixedDate", 12, 1, 15, "2027-01-15", 10000L, 90000L));
    }

    [Fact]
    public async Task Get_ListsTheFundsByDueDateWithTheMonthlyTotal()
    {
        (await PutAsync("f2", FixedDate())).EnsureSuccessStatusCode();
        (await PutAsync("f1", EveryMonths())).EnsureSuccessStatusCode();

        var overview = await ListAsync();

        overview!.Funds.Select(fund => fund.Id).ShouldBe(["f1", "f2"]);
        overview.TotalMonthlyCents.ShouldBe(20000);
    }

    [Fact]
    public async Task Put_AgainReplacesTheFund()
    {
        (await PutAsync("f1", EveryMonths())).EnsureSuccessStatusCode();

        (await PutAsync("f1", EveryMonths(intervalMonths: 6, nextDueDate: "2027-02-11"))).EnsureSuccessStatusCode();

        var funds = (await ListAsync())!.Funds;
        funds.Single().Schedule.IntervalMonths.ShouldBe(6);
    }

    [Fact]
    public async Task Delete_RemovesTheFundAndToleratesAnUnknownId()
    {
        (await PutAsync("f1", EveryMonths())).EnsureSuccessStatusCode();

        var first = await _client.DeleteAsync("/sinking-funds/f1");
        var unknown = await _client.DeleteAsync("/sinking-funds/nope");

        (first.StatusCode, unknown.StatusCode).ShouldBe((HttpStatusCode.NoContent, HttpStatusCode.NoContent));
        (await ListAsync())!.Funds.ShouldBeEmpty();
    }

    [Fact]
    public async Task Roll_CreatesTheBillOnceAndItShowsInTheBills()
    {
        (await PutAsync("f1", EveryMonths(nextDueDate: Today))).EnsureSuccessStatusCode();

        var first = await _client.PostAsJsonAsync("/sinking-funds/roll", new { today = Today });
        var second = await _client.PostAsJsonAsync("/sinking-funds/roll", new { today = Today });

        var created = await first.Content.ReadFromJsonAsync<BillResponse[]>(Json);
        (await second.Content.ReadFromJsonAsync<BillResponse[]>(Json)).ShouldBeEmpty();
        created!.Single().Id.ShouldBe("sf-f1-20261111");
        var agenda = await _client.GetFromJsonAsync<BillsAgendaResponse>($"/bills?date={Today}", Json);
        agenda!.Bills.Select(bill => bill.Id).ShouldContain("sf-f1-20261111");
    }

    [Fact]
    public async Task Put_AnUnknownCategoryIsNotFound()
    {
        var response = await PutAsync("f1", EveryMonths(categoryId: "nope"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Put_AZeroIntervalIsBadRequestNamingTheValue()
    {
        var response = await PutAsync("f1", EveryMonths(intervalMonths: 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("0");
    }

    [Fact]
    public async Task Put_EveryMonthsWithoutANextDueDateIsBadRequestNamingTheField()
    {
        var body = new { description = "Insurance", categoryId = "housing", amountCents = 100, schedule = new { kind = "everyMonths", intervalMonths = 3 } };

        var response = await PutAsync("f1", body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("next due date");
    }

    [Fact]
    public async Task Get_WithoutAValidTodayIsBadRequest()
    {
        var response = await _client.GetAsync("/sinking-funds?today=soon");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
