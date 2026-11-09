using Orbit.Api.Domain.Finances;
using Orbit.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

public sealed class SqliteIncomeSplitRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteIncomeSplitRepository _plans;

    public SqliteIncomeSplitRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _plans = new SqliteIncomeSplitRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await FinanceStarterSeed.ApplyOnceAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static IncomeSplitPart Part(string id, string name, int percent, params string[] categoryIds) =>
        IncomeSplitPart.Create(id, name, percent, 2, categoryIds);

    [Fact]
    public async Task Get_AnswersAnEmptyPlanBeforeTheFirstSave()
    {
        var plan = await _plans.GetAsync(CancellationToken.None);

        (plan.BaseIncomeCents, plan.Parts.Count).ShouldBe((0L, 0));
    }

    [Fact]
    public async Task Replace_RoundTripsThePartsInOrderWithTheirCategories()
    {
        var saved = IncomeSplit.Create(
            950000, [Part("fixed", "Fixed costs", 60, "housing", "food"), Part("fun", "Leisure", 10, "leisure")]);
        await _plans.ReplaceAsync(saved, CancellationToken.None);

        var plan = await _plans.GetAsync(CancellationToken.None);

        plan.BaseIncomeCents.ShouldBe(950000);
        plan.Parts.Select(part => (part.Id, part.Name, part.Percent, part.Color, string.Join(",", part.CategoryIds)))
            .ShouldBe([("fixed", "Fixed costs", 60, 2, "housing,food"), ("fun", "Leisure", 10, 2, "leisure")]);
    }

    [Fact]
    public async Task Replace_DropsThePartsOfThePreviousPlan()
    {
        await _plans.ReplaceAsync(IncomeSplit.Create(1000, [Part("old", "Old", 50, "food")]), CancellationToken.None);

        await _plans.ReplaceAsync(IncomeSplit.Create(2000, [Part("new", "New", 40, "food")]), CancellationToken.None);

        var plan = await _plans.GetAsync(CancellationToken.None);
        plan.BaseIncomeCents.ShouldBe(2000);
        plan.Parts.Select(part => part.Id).ShouldBe(["new"]);
    }

    [Fact]
    public async Task Replace_RefusesACategoryThatIsNotStored()
    {
        var plan = IncomeSplit.Create(0, [Part("a", "A", 10, "travel")]);

        await Should.ThrowAsync<SqliteException>(() => _plans.ReplaceAsync(plan, CancellationToken.None));
    }

    [Fact]
    public async Task DeletingACategory_TakesItOutOfItsPart()
    {
        await _plans.ReplaceAsync(IncomeSplit.Create(0, [Part("a", "A", 10, "food", "housing")]), CancellationToken.None);

        await new SqliteFinanceCategoryRepository(_connections).DeleteAsync("food", CancellationToken.None);

        (await _plans.GetAsync(CancellationToken.None)).Parts.Single().CategoryIds.ShouldBe(["housing"]);
    }

    [Fact]
    public async Task CategoryRepository_SavesAndRenamesWithoutMovingTheRow()
    {
        var categories = new SqliteFinanceCategoryRepository(_connections);
        await categories.SaveAsync(FinanceCategory.Create("courses", "Courses"), CancellationToken.None);

        await categories.SaveAsync(FinanceCategory.Create("courses", "Zebra study"), CancellationToken.None);

        var stored = await categories.FindAsync("courses", CancellationToken.None);
        (stored!.Name, (await categories.ListAsync(CancellationToken.None)).Count).ShouldBe(("Zebra study", 12));
    }

    [Fact]
    public async Task TransactionRepository_SeesWhichCategoriesAreUsed()
    {
        var transactions = new SqliteMoneyTransactionRepository(_connections);
        await transactions.SaveAsync(
            MoneyTransaction.Create("tx1", new DateOnly(2026, 11, 2), "Lunch", "food", "checking-account", -2500),
            CancellationToken.None);

        var food = await transactions.AnyInCategoryAsync("food", CancellationToken.None);
        var housing = await transactions.AnyInCategoryAsync("housing", CancellationToken.None);

        (food, housing).ShouldBe((true, false));
    }
}
