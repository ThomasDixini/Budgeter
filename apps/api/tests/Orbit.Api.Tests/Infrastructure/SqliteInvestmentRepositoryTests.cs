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
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _investments = new SqliteInvestmentRepository(_connections);
        _rates = new SqliteCdiRateStore(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
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
