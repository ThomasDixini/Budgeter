using Budgeter.Api.Application;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Tests.Fakes;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class InvestmentUseCaseTests
{
    private static readonly DateOnly January2 = new(2026, 1, 2);
    private static readonly DateOnly January6 = new(2026, 1, 6);

    private readonly InMemoryInvestmentRepository _investments = new();
    private readonly InMemoryCdiRateStore _rateStore = new();
    private LatestPrices _latestPrices => new(_investments, new FakeQuoteSource(), NullLogger<LatestPrices>.Instance);
    private readonly MonthEndPrices _monthEndPrices = new(new InMemoryMonthEndPriceStore(), new FakeQuoteSource(), NullLogger<MonthEndPrices>.Instance);
    private readonly FakeCdiRateSource _rateSource = new(
        new CdiRate(new DateOnly(2026, 1, 5), 0.05m), new CdiRate(January6, 0.05m));

    private SaveInvestment SaveInvestment => new(_investments);
    private SaveTrade SaveTrade => new(_investments);
    private GetPortfolio GetPortfolio => new(_investments, _rateStore, _rateSource, _monthEndPrices, _latestPrices, NullLogger<GetPortfolio>.Instance);

    private static SaveInvestmentCommand Petr4(long? price = 1200) => new("petr4", "PETR4", InvestmentKind.Stock, price, January6);

    private static SaveTradeCommand Trade(string id, TradeKind kind, long quantity, DateOnly? date = null) =>
        new(id, "petr4", date ?? January2, kind, quantity, 1000);

    [Fact]
    public async Task SaveInvestment_StoresItWithItsPriceAndReplacesItOnTheNextSave()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveInvestment.ExecuteAsync(Petr4(price: null), CancellationToken.None);

        var stored = await _investments.FindAsync("petr4", CancellationToken.None);
        stored!.Price.ShouldBeNull();
    }

    [Fact]
    public async Task SaveInvestment_APriceNeedsItsDay()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            SaveInvestment.ExecuteAsync(Petr4() with { PricedOn = null }, CancellationToken.None));

        exception.Message.ShouldContain("1200");
    }

    [Fact]
    public async Task SaveTrade_RejectsAnUnknownInvestment()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveTrade.ExecuteAsync(Trade("t1", TradeKind.Buy, 1000), CancellationToken.None));
    }

    [Fact]
    public async Task SaveTrade_RejectsASaleOfMoreThanWasHeld()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 10_000), CancellationToken.None);

        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveTrade.ExecuteAsync(Trade("sell", TradeKind.Sell, 20_000, January6), CancellationToken.None));
    }

    [Fact]
    public async Task SaveTrade_EditingAPurchaseCannotLeaveALaterSaleUncovered()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 10_000), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("sell", TradeKind.Sell, 10_000, January6), CancellationToken.None);

        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 5_000), CancellationToken.None));
    }

    [Fact]
    public async Task DeleteTrade_KeepsAPurchaseALaterSaleDependsOn()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 10_000), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("sell", TradeKind.Sell, 10_000, January6), CancellationToken.None);
        var deleteTrade = new DeleteTrade(_investments);

        await Should.ThrowAsync<ConflictException>(() => deleteTrade.ExecuteAsync("buy", CancellationToken.None));
        await deleteTrade.ExecuteAsync("sell", CancellationToken.None);
        await deleteTrade.ExecuteAsync("sell", CancellationToken.None);
        await deleteTrade.ExecuteAsync("buy", CancellationToken.None);

        (await _investments.ListTradesAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task DeleteInvestment_KeepsOneWithHistoryAndRemovesAnEmptyOne()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 10_000), CancellationToken.None);
        var delete = new DeleteInvestment(_investments);

        await Should.ThrowAsync<ConflictException>(() => delete.ExecuteAsync("petr4", CancellationToken.None));
        await new DeleteTrade(_investments).ExecuteAsync("buy", CancellationToken.None);
        await delete.ExecuteAsync("petr4", CancellationToken.None);

        (await _investments.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task SaveIncome_RequiresTheInvestmentAndCountsInThePortfolio()
    {
        var saveIncome = new SaveIncome(_investments);
        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            saveIncome.ExecuteAsync(new SaveIncomeCommand("i1", "petr4", January6, IncomeKind.Dividend, 1000), CancellationToken.None));
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);

        await saveIncome.ExecuteAsync(new SaveIncomeCommand("i1", "petr4", January6, IncomeKind.Dividend, 1000), CancellationToken.None);

        (await GetPortfolio.ExecuteAsync(January6, CancellationToken.None)).Portfolio.Totals.IncomeCents.ShouldBe(1000);
    }

    [Fact]
    public async Task GetPortfolio_FetchesTheCdiOnceFromTheFirstTradeAndKeepsIt()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 100_000), CancellationToken.None);

        var first = await GetPortfolio.ExecuteAsync(January6, CancellationToken.None);
        await GetPortfolio.ExecuteAsync(January6, CancellationToken.None);

        first.Portfolio.Performance!.CdiGainCents.ShouldBe(100);
        _rateSource.Asked.ShouldBe([(January2, January6)]);
    }

    [Fact]
    public async Task GetPortfolio_AsksOnlyForTheDaysAfterTheStoredRatesOnceTheyAreOldEnough()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 100_000), CancellationToken.None);
        await GetPortfolio.ExecuteAsync(January6, CancellationToken.None);

        await GetPortfolio.ExecuteAsync(January6.AddDays(14), CancellationToken.None);

        _rateSource.Asked.Last().ShouldBe((January6.AddDays(1), January6.AddDays(14)));
    }

    [Fact]
    public async Task GetPortfolio_ASourceThatFailsLeavesThePortfolioWithoutCdi()
    {
        _rateSource.Fails = true;
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);
        await SaveTrade.ExecuteAsync(Trade("buy", TradeKind.Buy, 100_000), CancellationToken.None);

        var snapshot = await GetPortfolio.ExecuteAsync(January6, CancellationToken.None);

        (snapshot.Portfolio.Performance!.GainCents, snapshot.Portfolio.Performance.CdiGainCents, snapshot.Portfolio.Performance.CdiThrough)
            .ShouldBe((20_000L, 0L, null));
    }

    [Fact]
    public async Task GetPortfolio_WithoutTradesNeverAsksForTheCdi()
    {
        await SaveInvestment.ExecuteAsync(Petr4(), CancellationToken.None);

        await GetPortfolio.ExecuteAsync(January6, CancellationToken.None);

        _rateSource.Asked.ShouldBeEmpty();
    }
}
