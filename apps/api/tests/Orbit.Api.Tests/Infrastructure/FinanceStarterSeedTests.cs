using Orbit.Api.Domain.Finances;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>The finance starter set reaches every database once, including ones seeded before Finances.</summary>
public sealed class FinanceStarterSeedTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;

    public FinanceStarterSeedTests()
    {
        _connections = TestUsers.FactoryFor(_database);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await TestUsers.InsertAsync(connection, TestUsers.DefaultId);
        await TestUsers.InsertAsync(connection, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private async Task StartAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await FinanceStarterSeed.ApplyOnceAsync(connection, TestUsers.DefaultId, CancellationToken.None);
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
    public async Task AFreshDatabase_GetsAStarterCardWithTermsToBillBy()
    {
        await StartAsync();

        var card = await new SqliteAccountRepository(_connections).FindAsync("credit-card", CancellationToken.None);

        card!.Card.ShouldBe(CardTerms.Create(500000, closingDay: 3, dueDay: 10));
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
            await SqliteCommands.ExecuteAsync(connection, "INSERT INTO sample_seed (user_id) VALUES ($user)", CancellationToken.None, ("$user", TestUsers.DefaultId));
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
            await SqliteCommands.ExecuteAsync(connection, "DELETE FROM accounts WHERE user_id = $user AND id = 'credit-card'", CancellationToken.None, ("$user", TestUsers.DefaultId));
        }

        await StartAsync();

        (await CountAsync("accounts")).ShouldBe(1);
    }

    [Fact]
    public async Task EachUser_GetsTheirOwnStarterSet()
    {
        await StartAsync();
        await FinanceTestSeeds.ApplyAsync(TestUsers.FactoryFor(_database, TestUsers.OtherId));

        var mine = await new SqliteAccountRepository(_connections).ListAsync(CancellationToken.None);
        var theirs = await new SqliteAccountRepository(TestUsers.FactoryFor(_database, TestUsers.OtherId)).ListAsync(CancellationToken.None);

        (mine.Count, theirs.Count, await CountAsync("accounts"), await CountAsync("finance_categories"))
            .ShouldBe((2, 2, 4L, 22L));
    }

    [Fact]
    public async Task SeedingASecondUser_StillRunsAfterTheFirstWasMarked()
    {
        await StartAsync();

        await FinanceTestSeeds.ApplyAsync(TestUsers.FactoryFor(_database, TestUsers.OtherId));

        (await CountAsync("finance_seed")).ShouldBe(2);
    }

    [Fact]
    public async Task AStarterItemOneUserDeleted_StaysInTheOtherUsersSet()
    {
        await StartAsync();
        var others = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await FinanceTestSeeds.ApplyAsync(others);

        await new SqliteAccountRepository(others).DeleteAsync("credit-card", CancellationToken.None);

        var mine = await new SqliteAccountRepository(_connections).ListAsync(CancellationToken.None);
        mine.Select(account => account.Id).ShouldBe(["checking-account", "credit-card"]);
    }
}

/// <summary>Gives a user of the spec's database the finance starter set, as sign-up does.</summary>
internal static class FinanceTestSeeds
{
    public static async Task ApplyAsync(SqliteConnectionFactory connections)
    {
        await using var connection = await connections.OpenAsync(CancellationToken.None);
        await FinanceStarterSeed.ApplyOnceAsync(connection, connections.UserId, CancellationToken.None);
    }
}
