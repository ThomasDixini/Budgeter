using Orbit.Api.Domain.Finances;
using Orbit.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

public sealed class SqliteMoneyTransactionRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly TransactionMonth October = TransactionMonth.Parse("2026-10");
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteMoneyTransactionRepository _transactions;

    public SqliteMoneyTransactionRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _transactions = new SqliteMoneyTransactionRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await TestUsers.InsertAsync(connection, TestUsers.DefaultId);
        await TestUsers.InsertAsync(connection, TestUsers.OtherId);
        await FinanceStarterSeed.ApplyAsync(connection, TestUsers.DefaultId, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static MoneyTransaction OnDay(string id, int month, int day, string description = "Groceries") =>
        MoneyTransaction.Create(id, new DateOnly(2026, month, day), description, "food", "credit-card", -28640);

    [Fact]
    public async Task Save_RoundTripsEveryField()
    {
        var salary = MoneyTransaction.Create(
            "tx1", new DateOnly(2026, 10, 5), "Salary", "salary", "checking-account", 950000);
        await _transactions.SaveAsync(salary, CancellationToken.None);

        var stored = (await _transactions.ListInMonthAsync(October, CancellationToken.None)).Single();

        (stored.Id, stored.Date, stored.Description, stored.CategoryId, stored.AccountId, stored.AmountCents)
            .ShouldBe(("tx1", new DateOnly(2026, 10, 5), "Salary", "salary", "checking-account", 950000L));
    }

    [Fact]
    public async Task ListInMonth_KeepsOnlyTheMonthsDaysFromFirstToLast()
    {
        await _transactions.SaveAsync(OnDay("sep30", 9, 30), CancellationToken.None);
        await _transactions.SaveAsync(OnDay("oct01", 10, 1), CancellationToken.None);
        await _transactions.SaveAsync(OnDay("oct31", 10, 31), CancellationToken.None);
        await _transactions.SaveAsync(OnDay("nov01", 11, 1), CancellationToken.None);

        var october = await _transactions.ListInMonthAsync(October, CancellationToken.None);

        october.Select(transaction => transaction.Id).ShouldBe(["oct31", "oct01"]);
    }

    [Fact]
    public async Task ListInMonth_PutsTheNewestOfADayFirst()
    {
        await _transactions.SaveAsync(OnDay("first", 10, 30), CancellationToken.None);
        await _transactions.SaveAsync(OnDay("second", 10, 30), CancellationToken.None);

        var october = await _transactions.ListInMonthAsync(October, CancellationToken.None);

        october.Select(transaction => transaction.Id).ShouldBe(["second", "first"]);
    }

    [Fact]
    public async Task Save_EditingATransactionKeepsItsPlaceInItsDay()
    {
        await _transactions.SaveAsync(OnDay("first", 10, 30), CancellationToken.None);
        await _transactions.SaveAsync(OnDay("second", 10, 30), CancellationToken.None);

        await _transactions.SaveAsync(OnDay("first", 10, 30, "Supermarket"), CancellationToken.None);

        var october = await _transactions.ListInMonthAsync(October, CancellationToken.None);
        october.Select(transaction => (transaction.Id, transaction.Description))
            .ShouldBe([("second", "Groceries"), ("first", "Supermarket")]);
    }

    [Fact]
    public async Task Delete_RemovesTheTransaction()
    {
        await _transactions.SaveAsync(OnDay("tx1", 10, 30), CancellationToken.None);

        await _transactions.DeleteAsync("tx1", CancellationToken.None);

        (await _transactions.ListInMonthAsync(October, CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Save_RefusesAnAccountThatIsNotStored()
    {
        var onUnknownAccount = MoneyTransaction.Create("tx1", new DateOnly(2026, 10, 1), "Cash", "food", "wallet", -100);

        await Should.ThrowAsync<SqliteException>(() => _transactions.SaveAsync(onUnknownAccount, CancellationToken.None));
    }

    private async Task<SqliteMoneyTransactionRepository> OtherUsersTransactionsAsync()
    {
        var others = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await FinanceStarterSeed.ApplyAsync(others);
        return new SqliteMoneyTransactionRepository(others);
    }

    private static MoneyTransaction Lunch(string id, long amountCents) =>
        MoneyTransaction.Create(id, new DateOnly(2026, 10, 5), "Lunch", "food", "checking-account", amountCents);

    [Fact]
    public async Task TwoUsers_StoreTheSameTransactionIdWithoutSeeingEachOther()
    {
        var others = await OtherUsersTransactionsAsync();
        await _transactions.SaveAsync(Lunch("tx1", -100), CancellationToken.None);
        await others.SaveAsync(Lunch("tx1", -900), CancellationToken.None);

        var mine = await _transactions.ListInMonthAsync(October, CancellationToken.None);
        var theirs = await others.ListInMonthAsync(October, CancellationToken.None);

        (mine.Single().AmountCents, theirs.Single().AmountCents).ShouldBe((-100L, -900L));
    }

    [Fact]
    public async Task Sum_CountsOnlyTheSignedInUsersTransactions()
    {
        var others = await OtherUsersTransactionsAsync();
        await _transactions.SaveAsync(Lunch("tx1", -100), CancellationToken.None);
        await others.SaveAsync(Lunch("tx2", -900), CancellationToken.None);

        var sum = await _transactions.SumAsync(
            "checking-account", new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1), CancellationToken.None);

        sum.ShouldBe(-100L);
    }

    [Fact]
    public async Task AnyChecks_IgnoreAnotherUsersTransactions()
    {
        var others = await OtherUsersTransactionsAsync();
        await others.SaveAsync(Lunch("tx1", -900), CancellationToken.None);

        var onAccount = await _transactions.AnyOnAccountAsync("checking-account", CancellationToken.None);
        var inCategory = await _transactions.AnyInCategoryAsync("food", CancellationToken.None);

        (onAccount, inCategory).ShouldBe((false, false));
    }

    [Fact]
    public async Task Delete_NeverRemovesAnotherUsersTransaction()
    {
        var others = await OtherUsersTransactionsAsync();
        await others.SaveAsync(Lunch("tx1", -900), CancellationToken.None);

        await _transactions.DeleteAsync("tx1", CancellationToken.None);

        (await others.ListInMonthAsync(October, CancellationToken.None)).Count.ShouldBe(1);
    }
}
