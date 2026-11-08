using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Tests.Fakes;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class LatestPricesTests
{
    private static readonly DateOnly November6 = new(2026, 11, 6);
    private static readonly DateOnly November9 = new(2026, 11, 9);

    private readonly InMemoryInvestmentRepository _investments = new();
    private readonly FakeQuoteSource _source = new() { Latest = new LatestQuote("PETR4", 3314, November9) };

    private LatestPrices Prices => new(_investments, _source, NullLogger<LatestPrices>.Instance);

    private static Investment Petr4(PricePoint? price) => Investment.Create("petr4", "PETR4", InvestmentKind.Stock, price);

    [Fact]
    public async Task Refresh_TakesAndStoresThePriceOfAnInvestmentWithoutOne()
    {
        var refreshed = await Prices.RefreshAsync([Petr4(null)], November9, CancellationToken.None);

        refreshed[0].Price!.Cents.ShouldBe(3314);
        (await _investments.ListAsync(CancellationToken.None)).Single().Price!.On.ShouldBe(November9);
    }

    [Fact]
    public async Task Refresh_ReplacesAPriceFromAnEarlierDay()
    {
        var old = PricePoint.Create(3000, November6);

        var refreshed = await Prices.RefreshAsync([Petr4(old)], November9, CancellationToken.None);

        refreshed[0].Price!.Cents.ShouldBe(3314);
    }

    [Fact]
    public async Task Refresh_DoesNotAskAgainForAPriceOfTheSameDay()
    {
        var today = PricePoint.Create(3000, November9);

        var refreshed = await Prices.RefreshAsync([Petr4(today)], November9, CancellationToken.None);

        refreshed[0].Price!.Cents.ShouldBe(3000);
        _source.LatestAsked.ShouldBe(0);
    }

    [Fact]
    public async Task Refresh_IgnoresAQuoteFromAfterTheDayBeingRead()
    {
        var refreshed = await Prices.RefreshAsync([Petr4(null)], November6, CancellationToken.None);

        refreshed[0].Price.ShouldBeNull();
    }

    [Fact]
    public async Task Refresh_LeavesInvestmentsWithoutAQuoteSymbolAlone()
    {
        var bond = Investment.Create("cdb", "CDB Bank", InvestmentKind.FixedIncome, null);

        var refreshed = await Prices.RefreshAsync([bond], November9, CancellationToken.None);

        refreshed[0].Price.ShouldBeNull();
        _source.LatestAsked.ShouldBe(0);
    }

    [Fact]
    public async Task Refresh_ASourceThatFailsKeepsTheHeldPrice()
    {
        _source.Fails = true;
        var old = PricePoint.Create(3000, November6);

        var refreshed = await Prices.RefreshAsync([Petr4(old)], November9, CancellationToken.None);

        refreshed[0].Price!.Cents.ShouldBe(3000);
    }
}
