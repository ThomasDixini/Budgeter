using Budgeter.Api.Domain.Investments;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class PortfolioTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly DateOnly January6 = new(2026, 1, 6);

    private static readonly CdiIndex TwoDaysOfCdi = new([
        new CdiRate(new DateOnly(2026, 1, 5), 0.05m), new CdiRate(January6, 0.05m),
    ]);

    private static Investment Petr4(long? priceCents) =>
        Investment.Create("petr4", "PETR4", InvestmentKind.Stock, priceCents is { } cents ? PricePoint.Create(cents, January6) : null);

    private static InvestmentTrade Buy100At10() =>
        InvestmentTrade.Create("t1", "petr4", January2, TradeKind.Buy, 100_000, 1000);

    private static Portfolio Build(
        Investment investment, IReadOnlyList<InvestmentTrade> trades, IReadOnlyList<InvestmentIncome>? incomes = null) =>
        Portfolio.Build([investment], trades, incomes ?? [], January6, TwoDaysOfCdi);

    [Fact]
    public void Line_ValuesTheUnitsHeldAtTheLatestPrice()
    {
        var line = Build(Petr4(1200), [Buy100At10()]).Lines.Single();

        (line.CostCents, line.ValueCents, line.GainCents).ShouldBe((100_000L, 120_000L, 20_000L));
    }

    [Fact]
    public void Line_WithoutAPriceIsValuedAtCostAndCounted()
    {
        var portfolio = Build(Petr4(null), [Buy100At10()]);

        (portfolio.Lines.Single().GainCents, portfolio.Totals.ValueCents, portfolio.Totals.UnpricedCount)
            .ShouldBe((null, 100_000L, 1));
    }

    [Fact]
    public void Line_AClosedPositionIsWorthNothingAndNeedsNoPrice()
    {
        var sale = InvestmentTrade.Create("t2", "petr4", January6, TradeKind.Sell, 100_000, 1100);

        var portfolio = Build(Petr4(null), [Buy100At10(), sale]);

        (portfolio.Lines.Single().ValueCents, portfolio.Totals.UnpricedCount).ShouldBe((0L, 0));
    }

    [Fact]
    public void Totals_SumIncomeAndTheLast12MonthsOfIt()
    {
        var incomes = new[]
        {
            InvestmentIncome.Create("i1", "petr4", January6, IncomeKind.Dividend, 1000),
            InvestmentIncome.Create("i2", "petr4", new DateOnly(2024, 1, 6), IncomeKind.Dividend, 700),
        };

        var totals = Build(Petr4(1200), [Buy100At10()], incomes).Totals;

        (totals.IncomeCents, totals.IncomeLast12MonthsCents).ShouldBe((1700L, 1000L));
    }

    [Fact]
    public void Lines_AreOrderedByValueLargestFirst()
    {
        var small = Investment.Create("small", "Small", InvestmentKind.Fund, PricePoint.Create(100, January6));
        var smallBuy = InvestmentTrade.Create("s1", "small", January2, TradeKind.Buy, 1000, 100);

        var portfolio = Portfolio.Build([small, Petr4(1200)], [smallBuy, Buy100At10()], [], January6, TwoDaysOfCdi);

        portfolio.Lines.Select(line => line.Investment.Id).ShouldBe(["petr4", "small"]);
    }

    [Fact]
    public void Performance_ComparesTheGainWithTheCdiOverTheSameMoney()
    {
        var performance = Build(Petr4(1200), [Buy100At10()]).Performance!;

        (performance.InvestedCents, performance.GainCents, performance.GainPercent, performance.CdiGainCents, performance.CdiPercent)
            .ShouldBe((100_000L, 20_000L, 20m, 100L, 0.1m));
    }

    [Fact]
    public void Performance_CountsProventosAsGainAndAsMoneyTakenOutOfTheCdi()
    {
        var income = InvestmentIncome.Create("i1", "petr4", new DateOnly(2026, 1, 5), IncomeKind.Dividend, 1000);

        var performance = Build(Petr4(1200), [Buy100At10()], [income]).Performance!;

        (performance.GainCents, performance.CdiGainCents).ShouldBe((21_000L, 100L));
    }

    [Fact]
    public void Performance_IsAbsentBeforeAnythingWasBought()
    {
        Build(Petr4(1200), []).Performance.ShouldBeNull();
    }

    [Fact]
    public void Performance_SaysHowFarTheCdiRatesGo()
    {
        Build(Petr4(1200), [Buy100At10()]).Performance!.CdiThrough.ShouldBe(January6);
    }
}
