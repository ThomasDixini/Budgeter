using Budgeter.Api.Domain.Finances;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>Bills stored over the starter finance categories.</summary>
public sealed class SqliteBillRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteBillRepository _bills;

    public SqliteBillRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _bills = new SqliteBillRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await FinanceStarterSeed.ApplyOnceAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static Budgeter.Api.Domain.Finances.Bill NewBill(string id, int month, int day, string categoryId = "housing") =>
        Budgeter.Api.Domain.Finances.Bill.Create(id, BillKind.Payable, "Rent", categoryId, 150000, new DateOnly(2026, month, day));

    [Fact]
    public async Task Find_ReadsBackASettledBillOfASeries()
    {
        var series = new BillSeries("s1", BillRecurrence.Installments, 2, 3);
        var bill = Budgeter.Api.Domain.Finances.Bill.Create("b1", BillKind.Receivable, "Course", "housing", 9000, new DateOnly(2026, 11, 5), series)
            .Settle(new DateOnly(2026, 11, 6), "checking-account");
        await _bills.SaveAsync(bill, CancellationToken.None);

        var found = await _bills.FindAsync("b1", CancellationToken.None);

        (found!.Kind, found.Settlement, found.Series, found.DueDate)
            .ShouldBe((BillKind.Receivable, new BillSettlement(new DateOnly(2026, 11, 6), "checking-account"), series, new DateOnly(2026, 11, 5)));
    }

    [Fact]
    public async Task Find_AnUnknownIdIsNull()
    {
        (await _bills.FindAsync("missing", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task ListOpenDueBefore_KeepsOpenBillsBeforeTheDayEarliestFirst()
    {
        await _bills.SaveAsync(NewBill("late", 12, 1), CancellationToken.None);
        await _bills.SaveAsync(NewBill("early", 11, 1), CancellationToken.None);
        await _bills.SaveAsync(NewBill("edge", 12, 31), CancellationToken.None);
        await _bills.SaveAsync(NewBill("paid", 10, 1).Settle(new DateOnly(2026, 10, 2), "checking-account"), CancellationToken.None);

        var open = await _bills.ListOpenDueBeforeAsync(new DateOnly(2026, 12, 31), CancellationToken.None);

        open.Select(bill => bill.Id).ShouldBe(["early", "late"]);
    }

    [Fact]
    public async Task ListSettledSince_KeepsRecentSettlementsLatestFirst()
    {
        await _bills.SaveAsync(NewBill("old", 9, 1).Settle(new DateOnly(2026, 9, 2), "checking-account"), CancellationToken.None);
        await _bills.SaveAsync(NewBill("a", 10, 1).Settle(new DateOnly(2026, 10, 5), "checking-account"), CancellationToken.None);
        await _bills.SaveAsync(NewBill("b", 10, 1).Settle(new DateOnly(2026, 10, 20), "checking-account"), CancellationToken.None);
        await _bills.SaveAsync(NewBill("open", 10, 1), CancellationToken.None);

        var settled = await _bills.ListSettledSinceAsync(new DateOnly(2026, 10, 1), CancellationToken.None);

        settled.Select(bill => bill.Id).ShouldBe(["b", "a"]);
    }

    [Fact]
    public async Task Save_ReplacesABillWithTheSameIdAndReopeningClearsItsSettlement()
    {
        var open = NewBill("b1", 11, 1);
        await _bills.SaveAsync(open.Settle(new DateOnly(2026, 11, 2), "checking-account"), CancellationToken.None);

        await _bills.SaveAsync(open, CancellationToken.None);

        (await _bills.FindAsync("b1", CancellationToken.None))!.IsSettled.ShouldBeFalse();
    }

    [Fact]
    public async Task Save_RefusesACategoryThatIsNotStored()
    {
        await Should.ThrowAsync<SqliteException>(() =>
            _bills.SaveAsync(NewBill("b1", 11, 1, categoryId: "missing"), CancellationToken.None));
    }

    [Fact]
    public async Task AnyInCategory_SeesOnlyTheCategoryUsedAndDeleteRemovesTheBill()
    {
        await _bills.SaveAsync(NewBill("b1", 11, 1), CancellationToken.None);

        var used = await _bills.AnyInCategoryAsync("housing", CancellationToken.None);
        var other = await _bills.AnyInCategoryAsync("food", CancellationToken.None);
        await _bills.DeleteAsync("b1", CancellationToken.None);

        (used, other, await _bills.AnyInCategoryAsync("housing", CancellationToken.None)).ShouldBe((true, false, false));
    }
}
