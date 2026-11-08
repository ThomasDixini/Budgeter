using Budgeter.Api.Domain.Investments;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>The stored month-end prices over a throwaway database.</summary>
public sealed class SqliteMonthEndPriceStoreTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteMonthEndPriceStore _prices;

    public SqliteMonthEndPriceStoreTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _prices = new SqliteMonthEndPriceStore(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Save_KeepsOneRecordPerSymbolAndMonthAndIgnoresARepeat()
    {
        await _prices.SaveAsync([new("PETR4", "2026-01", 3845)], CancellationToken.None);
        await _prices.SaveAsync([new("PETR4", "2026-01", 9999), new("PETR4", "2026-02", 3900)], CancellationToken.None);

        (await _prices.ListAsync(CancellationToken.None))
            .ShouldBe([new MonthEndPrice("PETR4", "2026-01", 3845), new MonthEndPrice("PETR4", "2026-02", 3900)]);
    }

    [Fact]
    public async Task LastMonth_IsTheLatestOfTheSymbolOrNullWhenThereIsNone()
    {
        await _prices.SaveAsync([new("PETR4", "2026-01", 3845), new("PETR4", "2026-03", 3900)], CancellationToken.None);

        (await _prices.LastMonthAsync("PETR4", CancellationToken.None)).ShouldBe("2026-03");
        (await _prices.LastMonthAsync("VALE3", CancellationToken.None)).ShouldBeNull();
    }
}
