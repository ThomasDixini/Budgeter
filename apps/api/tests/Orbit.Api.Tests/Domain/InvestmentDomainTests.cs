using Orbit.Api.Domain;
using Orbit.Api.Domain.Investments;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class InvestmentDomainTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    private static InvestmentTrade Trade(
        string id, TradeKind kind, long quantity, long priceCents, DateOnly? date = null) =>
        InvestmentTrade.Create(id, "petr4", date ?? January2, kind, quantity, priceCents);

    [Fact]
    public void Investment_TrimsTheNameAndRejectsABlankOne()
    {
        Investment.Create("petr4", " PETR4 ", InvestmentKind.Stock, null).Name.ShouldBe("PETR4");
        Should.Throw<DomainRuleException>(() => Investment.Create("petr4", "  ", InvestmentKind.Stock, null));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void PricePoint_RejectsAPriceBelowOneCent(long cents)
    {
        Should.Throw<DomainRuleException>(() => PricePoint.Create(cents, January2)).Message.ShouldContain($"received {cents}");
    }

    [Fact]
    public void Trade_TotalIsUnitsTimesPriceRoundedToTheCent()
    {
        var trade = Trade("t1", TradeKind.Buy, quantity: 2_500, priceCents: 1001);

        trade.TotalCents.ShouldBe(2503);
    }

    [Theory]
    [InlineData(0, 100)]
    [InlineData(100, 0)]
    [InlineData(InvestmentTrade.MaxQuantityThousandths + 1, 100)]
    public void Trade_RejectsAQuantityOrPriceOutsideTheLimits(long quantity, long price)
    {
        Should.Throw<DomainRuleException>(() => Trade("t1", TradeKind.Buy, quantity, price));
    }

    [Fact]
    public void Income_RejectsAnAmountOfZero()
    {
        Should.Throw<DomainRuleException>(() =>
            InvestmentIncome.Create("i1", "petr4", January2, IncomeKind.Dividend, 0));
    }

    [Fact]
    public void Position_BuysAddUnitsAndCost()
    {
        var position = Position.Replay("petr4", [Trade("a", TradeKind.Buy, 100_000, 1000), Trade("b", TradeKind.Buy, 100_000, 1200)]);

        position.ShouldBe(new Position(200_000, 220_000));
    }

    [Fact]
    public void Position_ASaleTakesItsShareOfTheCostAtTheAveragePrice()
    {
        var position = Position.Replay(
            "petr4",
            [Trade("a", TradeKind.Buy, 100_000, 1000), Trade("b", TradeKind.Sell, 40_000, 1500, January2.AddDays(5))]);

        position.ShouldBe(new Position(60_000, 60_000));
    }

    [Fact]
    public void Position_ASaleOnTheDayOfTheBuyIsReplayedAfterIt()
    {
        var position = Position.Replay("petr4", [Trade("sell", TradeKind.Sell, 10_000, 1000), Trade("buy", TradeKind.Buy, 10_000, 1000)]);

        position.QuantityThousandths.ShouldBe(0);
    }

    [Fact]
    public void Position_RejectsSellingMoreThanWasHeld()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Position.Replay("petr4", [Trade("a", TradeKind.Buy, 10_000, 1000), Trade("b", TradeKind.Sell, 20_000, 1000, January2.AddDays(1))]));

        exception.Message.ShouldContain("20000");
    }

    [Fact]
    public void CdiIndex_GrowsOverTheDaysAfterTheStartUpToTheEnd()
    {
        var index = new CdiIndex([
            new CdiRate(January2, 1m), new CdiRate(January2.AddDays(3), 0.05m), new CdiRate(January2.AddDays(4), 0.05m),
        ]);

        index.FactorBetween(January2, January2.AddDays(4)).ShouldBe(1.0005m * 1.0005m);
        index.FactorBetween(January2.AddDays(4), January2.AddDays(9)).ShouldBe(1m);
        index.Through.ShouldBe(January2.AddDays(4));
    }
}
