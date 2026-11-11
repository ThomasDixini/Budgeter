using Microsoft.Data.Sqlite;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>Sinking funds stored over the starter finance categories.</summary>
public sealed class SqliteSinkingFundRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteSinkingFundRepository _funds;

    public SqliteSinkingFundRepositoryTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _funds = new SqliteSinkingFundRepository(_connections);
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

    private static SinkingFund NewFund(string id, int month, int day, string description = "Insurance", string categoryId = "housing") =>
        SinkingFund.Create(
            id, description, categoryId, 120000, SinkingFundSchedule.EveryMonths(6, day), new DateOnly(2026, month, day));

    [Fact]
    public async Task Find_ReadsBackAnEveryMonthsFund()
    {
        await _funds.SaveAsync(NewFund("f1", 11, 30), CancellationToken.None);

        var found = await _funds.FindAsync("f1", CancellationToken.None);

        (found!.Schedule, found.NextDueDate, found.AmountCents, found.CategoryId)
            .ShouldBe((SinkingFundSchedule.EveryMonths(6, 30), new DateOnly(2026, 11, 30), 120000L, "housing"));
    }

    [Fact]
    public async Task Find_ReadsBackAFixedDateFund()
    {
        var fund = SinkingFund.Create(
            "f1", "Tax", "housing", 90000, SinkingFundSchedule.FixedDate(1, 31), new DateOnly(2027, 1, 31));
        await _funds.SaveAsync(fund, CancellationToken.None);

        var found = await _funds.FindAsync("f1", CancellationToken.None);

        (found!.Schedule, found.NextDueDate).ShouldBe((SinkingFundSchedule.FixedDate(1, 31), new DateOnly(2027, 1, 31)));
    }

    [Fact]
    public async Task Find_AnUnknownIdIsNull()
    {
        (await _funds.FindAsync("missing", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Save_ReplacesAFundWithTheSameIdAndKeepsOneRow()
    {
        await _funds.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);

        await _funds.SaveAsync(NewFund("f1", 12, 5, "Renamed"), CancellationToken.None);

        var all = await _funds.ListAsync(CancellationToken.None);
        all.Select(fund => (fund.Description, fund.NextDueDate)).ShouldBe([("Renamed", new DateOnly(2026, 12, 5))]);
    }

    [Fact]
    public async Task Save_KeepsTheRowIdSoTheListOrderOfTiesIsStable()
    {
        await _funds.SaveAsync(NewFund("first", 11, 1), CancellationToken.None);
        await _funds.SaveAsync(NewFund("second", 11, 1), CancellationToken.None);

        await _funds.SaveAsync(NewFund("first", 11, 1), CancellationToken.None);

        (await _funds.ListAsync(CancellationToken.None)).Select(fund => fund.Id).ShouldBe(["first", "second"]);
    }

    [Fact]
    public async Task List_OrdersByDueDateThenDescription()
    {
        await _funds.SaveAsync(NewFund("late", 12, 1, "Aaa"), CancellationToken.None);
        await _funds.SaveAsync(NewFund("b", 11, 1, "Bravo"), CancellationToken.None);
        await _funds.SaveAsync(NewFund("a", 11, 1, "Alpha"), CancellationToken.None);

        var all = await _funds.ListAsync(CancellationToken.None);

        all.Select(fund => fund.Id).ShouldBe(["a", "b", "late"]);
    }

    [Fact]
    public async Task ListDueOnOrBefore_IncludesTheDayAndExcludesTheDayAfter()
    {
        await _funds.SaveAsync(NewFund("before", 11, 9), CancellationToken.None);
        await _funds.SaveAsync(NewFund("on", 11, 10), CancellationToken.None);
        await _funds.SaveAsync(NewFund("after", 11, 11), CancellationToken.None);

        var due = await _funds.ListDueOnOrBeforeAsync(new DateOnly(2026, 11, 10), CancellationToken.None);

        due.Select(fund => fund.Id).ShouldBe(["before", "on"]);
    }

    [Fact]
    public async Task Delete_RemovesTheFundAndIgnoresAnUnknownId()
    {
        await _funds.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);

        await _funds.DeleteAsync("missing", CancellationToken.None);
        await _funds.DeleteAsync("f1", CancellationToken.None);

        (await _funds.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Save_RefusesACategoryThatIsNotStored()
    {
        await Should.ThrowAsync<SqliteException>(() =>
            _funds.SaveAsync(NewFund("f1", 11, 1, categoryId: "missing"), CancellationToken.None));
    }

    [Fact]
    public async Task AnyInCategory_SeesOnlyTheCategoryUsed()
    {
        await _funds.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);

        var used = await _funds.AnyInCategoryAsync("housing", CancellationToken.None);
        var other = await _funds.AnyInCategoryAsync("food", CancellationToken.None);

        (used, other).ShouldBe((true, false));
    }

    private async Task<SqliteSinkingFundRepository> OtherUsersFundsAsync()
    {
        var others = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        await FinanceStarterSeed.ApplyAsync(others);
        return new SqliteSinkingFundRepository(others);
    }

    [Fact]
    public async Task TwoUsers_StoreTheSameFundIdWithoutSeeingEachOther()
    {
        var others = await OtherUsersFundsAsync();
        await _funds.SaveAsync(NewFund("f1", 11, 1, "Mine"), CancellationToken.None);
        await others.SaveAsync(NewFund("f1", 11, 2, "Theirs", "food"), CancellationToken.None);

        var mine = await _funds.FindAsync("f1", CancellationToken.None);
        var theirs = await others.FindAsync("f1", CancellationToken.None);

        (mine!.Description, theirs!.Description).ShouldBe(("Mine", "Theirs"));
    }

    [Fact]
    public async Task Queries_NeverSeeAnotherUsersFunds()
    {
        var others = await OtherUsersFundsAsync();
        await others.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);

        await _funds.DeleteAsync("f1", CancellationToken.None);

        var seen = (
            (await _funds.ListAsync(CancellationToken.None)).Count,
            (await _funds.ListDueOnOrBeforeAsync(new DateOnly(2030, 1, 1), CancellationToken.None)).Count,
            await _funds.AnyInCategoryAsync("housing", CancellationToken.None),
            (await others.FindAsync("f1", CancellationToken.None)) is not null);
        seen.ShouldBe((0, 0, false, true));
    }

    [Fact]
    public async Task Find_AnUnknownScheduleKindNamesTheValueAndTheExpectedKinds()
    {
        await _funds.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection, "UPDATE sinking_funds SET schedule_kind = 'Weekly'", CancellationToken.None);
        }

        var failure = await Should.ThrowAsync<InvalidOperationException>(() => _funds.FindAsync("f1", CancellationToken.None));

        failure.Message.ShouldContain("'Weekly'");
        failure.Message.ShouldContain("EveryMonths or FixedDate");
    }

    [Fact]
    public async Task EnsureCreated_AddsTheTableToADatabaseThatLacksIt()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DROP TABLE sinking_funds", CancellationToken.None);
            await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        }

        await _funds.SaveAsync(NewFund("f1", 11, 1), CancellationToken.None);

        (await _funds.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
    }
}
