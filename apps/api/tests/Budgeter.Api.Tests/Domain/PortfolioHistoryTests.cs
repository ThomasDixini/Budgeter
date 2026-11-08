using Budgeter.Api.Domain.Investments;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class PortfolioHistoryTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly DateOnly March10 = new(2026, 3, 10);
    private static readonly CdiIndex NoCdi = new([]);

    private static Investment Petr4(PricePoint? price = null) =>
        Investment.Create("petr4", "PETR4", InvestmentKind.Stock, price);

    private static InvestmentTrade Buy100At10() =>
        InvestmentTrade.Create("t1", "petr4", January2, TradeKind.Buy, 100_000, 1000);

    private static MonthEndPrice Close(string month, long cents) => new("PETR4", month, cents);

    private static IReadOnlyList<MonthlyPoint> Build(
        Investment investment, IReadOnlyList<MonthEndPrice> prices, IReadOnlyList<InvestmentIncome>? incomes = null) =>
        PortfolioHistory.Build([investment], [Buy100At10()], incomes ?? [], prices, NoCdi, March10);

    [Fact]
    public void Build_WithoutTradesHasNoHistory()
    {
        PortfolioHistory.Build([Petr4()], [], [], [], NoCdi, March10).ShouldBeEmpty();
    }

    [Fact]
    public void Build_HasOnePointForEachMonthFromTheFirstTradeToTheMonthOfTheDay()
    {
        var months = Build(Petr4(), []).Select(point => point.Month);

        months.ShouldBe(["2026-01", "2026-02", "2026-03"]);
    }

    [Fact]
    public void Build_ValuesEachMonthAtItsOwnClosingPrice()
    {
        var points = Build(Petr4(), [Close("2026-01", 1100), Close("2026-02", 900)]);

        points.Select(point => point.ValueCents).ShouldBe([110_000L, 90_000L, 90_000L]);
    }

    [Fact]
    public void Build_ValuesTheMonthOfTheDayAtThePriceTypedForTheInvestment()
    {
        var typed = PricePoint.Create(1300, March10);

        var points = Build(Petr4(typed), [Close("2026-02", 900)]);

        points[^1].ValueCents.ShouldBe(130_000);
    }

    [Fact]
    public void Build_ValuesAtCostWhenNoPriceIsKnownForTheMonth()
    {
        var points = Build(Petr4(), []);

        points.Select(point => (point.ValueCents, point.ReturnPercent)).ShouldBe([(100_000L, 0m), (100_000L, 0m), (100_000L, 0m)]);
    }

    [Fact]
    public void Build_ReturnCountsWhatWasReceivedAsProventos()
    {
        var provento = InvestmentIncome.Create("i1", "petr4", new DateOnly(2026, 2, 15), IncomeKind.Dividend, 5_000);

        var points = Build(Petr4(), [Close("2026-01", 1100), Close("2026-02", 1100)], [provento]);

        points.Select(point => point.ReturnPercent).ShouldBe([10m, 15m, 15m]);
    }

    [Fact]
    public void Build_CdiGrowsTheMoneyFromTheDayItWasPutIn()
    {
        var cdi = new CdiIndex([new CdiRate(new DateOnly(2026, 1, 5), 1m)]);

        var points = PortfolioHistory.Build([Petr4()], [Buy100At10()], [], [], cdi, March10);

        points.Select(point => point.CdiPercent).ShouldBe([1m, 1m, 1m]);
    }

    [Fact]
    public void Build_DoesNotUseAPriceFromAnInvestmentWithoutAQuoteSymbol()
    {
        var fixedIncome = Investment.Create("cdb", "CDB Bank", InvestmentKind.FixedIncome, null);
        var buy = InvestmentTrade.Create("t1", "cdb", January2, TradeKind.Buy, 1_000, 100_000);

        var points = PortfolioHistory.Build([fixedIncome], [buy], [], [new MonthEndPrice("CDB", "2026-01", 5)], NoCdi, March10);

        points[0].ValueCents.ShouldBe(100_000);
    }
}
