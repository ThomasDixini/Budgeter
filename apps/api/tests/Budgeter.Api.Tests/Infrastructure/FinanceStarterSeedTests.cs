using Budgeter.Api.Domain.Finances;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>The finance starter set reaches every database once, including ones seeded before Finances.</summary>
public sealed class FinanceStarterSeedTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;

    public FinanceStarterSeedTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private async Task StartAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await FinanceStarterSeed.ApplyOnceAsync(connection, CancellationToken.None);
    }

    private async Task<long> CountAsync(string table)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var counts = await SqliteCommands.QueryAsync(
            connection, $"SELECT COUNT(*) FROM {table}", reader => reader.GetInt64(0), CancellationToken.None);
        return counts[0];
    }

    [Fact]
    public async Task AFreshDatabase_GetsTheStarterAccounts()
    {
        await StartAsync();

        var accounts = await new SqliteAccountRepository(_connections).ListAsync(CancellationToken.None);

        accounts.Select(account => (account.Id, account.Kind))
            .ShouldBe([("checking-account", AccountKind.BankAccount), ("credit-card", AccountKind.CreditCard)]);
    }

    [Fact]
    public async Task AFreshDatabase_GetsTheStarterCategoriesSortedByName()
    {
        await StartAsync();

        var categories = await new SqliteFinanceCategoryRepository(_connections).ListAsync(CancellationToken.None);

        (categories.Count, categories[0].Name, categories[^1].Name).ShouldBe((11, "Education", "Transport"));
    }

    // Regression guard: databases created before Finances already carry the sample_seed marker.
    [Fact]
    public async Task ADatabaseSeededWithSampleDataBefore_StillGetsTheStarterSet()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "INSERT INTO sample_seed (id) VALUES (1)", CancellationToken.None);
        }

        await StartAsync();

        (await CountAsync("accounts")).ShouldBe(2);
    }

    [Fact]
    public async Task AStarterItemTheUserDeleted_DoesNotComeBack()
    {
        await StartAsync();
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DELETE FROM accounts WHERE id = 'credit-card'", CancellationToken.None);
        }

        await StartAsync();

        (await CountAsync("accounts")).ShouldBe(1);
    }
}
