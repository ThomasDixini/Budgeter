using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Tests.Fakes;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class MonthEndPricesTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly DateOnly March10 = new(2026, 3, 10);

    private readonly InMemoryMonthEndPriceStore _store = new();
    private readonly FakeQuoteSource _source = new(
        new MonthEndPrice("PETR4", "2026-01", 1100), new MonthEndPrice("PETR4", "2026-02", 900),
        new MonthEndPrice("PETR4", "2026-03", 950));

    private MonthEndPrices Prices => new(_store, _source, NullLogger<MonthEndPrices>.Instance);

    private static Investment Petr4() => Investment.Create("petr4", "PETR4", InvestmentKind.Stock, null);

    private static InvestmentTrade Buy(DateOnly date) =>
        InvestmentTrade.Create("t1", "petr4", date, TradeKind.Buy, 100_000, 1000);

    [Fact]
    public async Task Load_AsksFromTheFirstTradeMonthToTheLastFinishedOneAndKeepsOnlyFinishedMonths()
    {
        var prices = await Prices.LoadAsync([Petr4()], [Buy(January2)], March10, CancellationToken.None);

        _source.Asked.ShouldBe([("PETR4", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 28))]);
        prices.Select(price => price.Month).ShouldBe(["2026-01", "2026-02"]);
    }

    [Fact]
    public async Task Load_AsksOnlyForTheMonthsAfterTheStoredOnes()
    {
        await _store.SaveAsync([new MonthEndPrice("PETR4", "2026-01", 1100)], CancellationToken.None);

        await Prices.LoadAsync([Petr4()], [Buy(January2)], March10, CancellationToken.None);

        _source.Asked.ShouldBe([("PETR4", new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28))]);
    }

    [Fact]
    public async Task Load_DoesNotAskAgainOnceTheLastFinishedMonthIsStored()
    {
        await Prices.LoadAsync([Petr4()], [Buy(January2)], March10, CancellationToken.None);

        await Prices.LoadAsync([Petr4()], [Buy(January2)], March10.AddDays(5), CancellationToken.None);

        _source.Asked.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Load_DoesNotAskForATradeMadeInTheCurrentMonth()
    {
        await Prices.LoadAsync([Petr4()], [Buy(new DateOnly(2026, 3, 2))], March10, CancellationToken.None);

        _source.Asked.ShouldBeEmpty();
    }

    [Fact]
    public async Task Load_SkipsInvestmentsWithoutAQuoteSymbol()
    {
        var bond = Investment.Create("cdb", "CDB Bank", InvestmentKind.FixedIncome, null);
        var buy = InvestmentTrade.Create("t1", "cdb", January2, TradeKind.Buy, 1_000, 100_000);

        await Prices.LoadAsync([bond], [buy], March10, CancellationToken.None);

        _source.Asked.ShouldBeEmpty();
    }

    [Fact]
    public async Task Load_ASourceThatFailsLeavesTheStoredPrices()
    {
        await _store.SaveAsync([new MonthEndPrice("PETR4", "2025-12", 800)], CancellationToken.None);
        _source.Fails = true;

        var prices = await Prices.LoadAsync([Petr4()], [Buy(January2)], March10, CancellationToken.None);

        prices.Select(price => price.Month).ShouldBe(["2025-12"]);
    }
}
