using Orbit.Api.Domain.Investments;
using Orbit.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Investments, trades, proventos and the stored CDI rates over a throwaway database.</summary>
public sealed class SqliteInvestmentRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly January2 = new(2026, 1, 2);

    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteInvestmentRepository _investments;
    private readonly SqliteCdiRateStore _rates;

    public SqliteInvestmentRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _investments = new SqliteInvestmentRepository(_connections);
        _rates = new SqliteCdiRateStore(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static Investment Petr4(PricePoint? price = null) =>
        Investment.Create("petr4", "PETR4", InvestmentKind.Stock, price);

    private static InvestmentTrade Trade(string id, DateOnly date, TradeKind kind = TradeKind.Buy) =>
        InvestmentTrade.Create(id, "petr4", date, kind, 100_000, 1000);

    [Fact]
    public async Task Investment_IsReadBackWithItsPriceAndReplacedOnTheNextSaveWithoutMoving()
    {
        await _investments.SaveAsync(Petr4(PricePoint.Create(3845, January2)), CancellationToken.None);
        await _investments.SaveAsync(Investment.Create("a", "Another", InvestmentKind.Fund, null), CancellationToken.None);

        await _investments.SaveAsync(Petr4(), CancellationToken.None);

        var all = await _investments.ListAsync(CancellationToken.None);
        all.Select(investment => (investment.Id, investment.Price)).ShouldBe([("petr4", (PricePoint?)null), ("a", null)]);
    }

    [Fact]
    public async Task Trades_AreListedOldestFirstAndReadBackWhole()
    {
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await _investments.SaveTradeAsync(Trade("late", January2.AddDays(5), TradeKind.Sell), CancellationToken.None);
        await _investments.SaveTradeAsync(Trade("early", January2), CancellationToken.None);

        var trades = await _investments.ListTradesAsync(CancellationToken.None);

        trades.Select(trade => (trade.Id, trade.Kind, trade.QuantityThousandths, trade.UnitPriceCents))
            .ShouldBe([("early", TradeKind.Buy, 100_000L, 1000L), ("late", TradeKind.Sell, 100_000L, 1000L)]);
    }

    [Fact]
    public async Task Incomes_AreListedNewestFirst()
    {
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await _investments.SaveIncomeAsync(InvestmentIncome.Create("old", "petr4", January2, IncomeKind.Yield, 500), CancellationToken.None);
        await _investments.SaveIncomeAsync(InvestmentIncome.Create("new", "petr4", January2.AddDays(30), IncomeKind.InterestOnEquity, 700), CancellationToken.None);

        var incomes = await _investments.ListIncomesAsync(CancellationToken.None);

        incomes.Select(income => (income.Id, income.Kind)).ShouldBe([("new", IncomeKind.InterestOnEquity), ("old", IncomeKind.Yield)]);
    }

    [Fact]
    public async Task HasActivity_SeesTradesAndIncomesAndDeleteRemovesThem()
    {
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        var before = await _investments.HasActivityAsync("petr4", CancellationToken.None);
        await _investments.SaveTradeAsync(Trade("t1", January2), CancellationToken.None);
        var withTrade = await _investments.HasActivityAsync("petr4", CancellationToken.None);
        await _investments.DeleteTradeAsync("t1", CancellationToken.None);
        await _investments.SaveIncomeAsync(InvestmentIncome.Create("i1", "petr4", January2, IncomeKind.Dividend, 1), CancellationToken.None);
        var withIncome = await _investments.HasActivityAsync("petr4", CancellationToken.None);
        await _investments.DeleteIncomeAsync("i1", CancellationToken.None);

        (before, withTrade, withIncome, await _investments.HasActivityAsync("petr4", CancellationToken.None))
            .ShouldBe((false, true, true, false));
    }

    [Fact]
    public async Task Trade_RefusesAnInvestmentThatIsNotStored()
    {
        await Should.ThrowAsync<SqliteException>(() =>
            _investments.SaveTradeAsync(Trade("t1", January2), CancellationToken.None));
    }

    private SqliteInvestmentRepository RepositoryOfOtherUser() =>
        new(TestUsers.FactoryFor(_database, TestUsers.OtherId));

    [Fact]
    public async Task Investments_OfTwoUsersCanShareIdsAndNeverMix()
    {
        var other = RepositoryOfOtherUser();
        await _investments.SaveAsync(Petr4(PricePoint.Create(3845, January2)), CancellationToken.None);
        await other.SaveAsync(Investment.Create("petr4", "Other PETR4", InvestmentKind.Fund, null), CancellationToken.None);

        var mine = await _investments.FindAsync("petr4", CancellationToken.None);
        var theirs = await other.FindAsync("petr4", CancellationToken.None);

        (mine!.Name, theirs!.Name).ShouldBe(("PETR4", "Other PETR4"));
        (await _investments.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
        (await other.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task DeletingAnInvestment_NeverTouchesTheOtherUsersOne()
    {
        var other = RepositoryOfOtherUser();
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await other.SaveAsync(Petr4(), CancellationToken.None);

        await _investments.DeleteAsync("petr4", CancellationToken.None);

        (await _investments.FindAsync("petr4", CancellationToken.None)).ShouldBeNull();
        (await other.FindAsync("petr4", CancellationToken.None)).ShouldNotBeNull();
    }

    [Fact]
    public async Task Trades_OfTwoUsersCanShareIdsAndNeverMixOrDeleteEachOther()
    {
        var other = RepositoryOfOtherUser();
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await other.SaveAsync(Petr4(), CancellationToken.None);
        await _investments.SaveTradeAsync(Trade("t1", January2), CancellationToken.None);
        await other.SaveTradeAsync(Trade("t1", January2.AddDays(1), TradeKind.Sell), CancellationToken.None);

        await _investments.DeleteTradeAsync("t1", CancellationToken.None);

        (await _investments.ListTradesAsync(CancellationToken.None)).ShouldBeEmpty();
        (await _investments.FindTradeAsync("t1", CancellationToken.None)).ShouldBeNull();
        var theirs = await other.ListTradesAsync(CancellationToken.None);
        theirs.Select(trade => (trade.Id, trade.Kind)).ShouldBe([("t1", TradeKind.Sell)]);
    }

    [Fact]
    public async Task Incomes_OfTwoUsersCanShareIdsAndNeverMixOrDeleteEachOther()
    {
        var other = RepositoryOfOtherUser();
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await other.SaveAsync(Petr4(), CancellationToken.None);
        await _investments.SaveIncomeAsync(InvestmentIncome.Create("i1", "petr4", January2, IncomeKind.Yield, 500), CancellationToken.None);
        await other.SaveIncomeAsync(InvestmentIncome.Create("i1", "petr4", January2, IncomeKind.Dividend, 900), CancellationToken.None);

        await _investments.DeleteIncomeAsync("i1", CancellationToken.None);

        (await _investments.ListIncomesAsync(CancellationToken.None)).ShouldBeEmpty();
        var theirs = await other.ListIncomesAsync(CancellationToken.None);
        theirs.Select(income => (income.Id, income.AmountCents)).ShouldBe([("i1", 900L)]);
    }

    [Fact]
    public async Task HasActivity_OnlyCountsTheUsersOwnTradesAndIncomes()
    {
        var other = RepositoryOfOtherUser();
        await _investments.SaveAsync(Petr4(), CancellationToken.None);
        await other.SaveAsync(Petr4(), CancellationToken.None);
        await other.SaveTradeAsync(Trade("t1", January2), CancellationToken.None);

        (await _investments.HasActivityAsync("petr4", CancellationToken.None)).ShouldBeFalse();
        (await other.HasActivityAsync("petr4", CancellationToken.None)).ShouldBeTrue();
    }

    [Fact]
    public async Task Trade_RefusesAnInvestmentOnlyTheOtherUserHas()
    {
        await RepositoryOfOtherUser().SaveAsync(Petr4(), CancellationToken.None);

        await Should.ThrowAsync<SqliteException>(() =>
            _investments.SaveTradeAsync(Trade("t1", January2), CancellationToken.None));
    }

    [Fact]
    public async Task CdiRates_AreStoredOncePerDayWithTheirCoverage()
    {
        (await _rates.CoverageAsync(CancellationToken.None)).ShouldBeNull();

        await _rates.SaveAsync([new CdiRate(January2, 0.054266m), new CdiRate(January2.AddDays(3), 0.05m)], CancellationToken.None);
        await _rates.SaveAsync([new CdiRate(January2, 9m)], CancellationToken.None);

        var rates = await _rates.ListFromAsync(January2, CancellationToken.None);
        rates.ShouldBe([new CdiRate(January2, 0.054266m), new CdiRate(January2.AddDays(3), 0.05m)]);
        (await _rates.CoverageAsync(CancellationToken.None)).ShouldBe((January2, January2.AddDays(3)));
    }
}
