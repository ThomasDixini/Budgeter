using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteCategoryRepository _categories;
    private readonly SqliteGoalRepository _goals;

    public SqliteRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _categories = new SqliteCategoryRepository(_connections);
        _goals = new SqliteGoalRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await _categories.AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Categories_RoundTripInCreationOrder()
    {
        await _categories.AddAsync(Category.Create("languages", "Languages", "#86EFAC"), CancellationToken.None);

        var categories = await _categories.ListAsync(CancellationToken.None);

        categories.Select(category => (category.Id, category.Name, category.Color))
            .ShouldBe([("study", "Study", "#7DD3FC"), ("languages", "Languages", "#86EFAC")]);
    }

    [Fact]
    public async Task Categories_FindReturnsNullForUnknownId()
    {
        (await _categories.FindAsync("missing", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Goals_RoundTripEveryField()
    {
        var definition = GoalDefinitions.CourseObjective();
        await _goals.AddAsync(Goal.Create(definition), CancellationToken.None);

        var stored = await _goals.FindAsync(definition.Id, TestDays.Today, CancellationToken.None);

        stored!.Definition.ShouldBe(definition);
        stored.Done.ShouldBe(0);
    }

    [Fact]
    public async Task Goals_RejectUnknownCategoryThroughForeignKey()
    {
        var goal = Goal.Create(GoalDefinitions.WeeklyStudy(categoryId: "missing"));

        await Should.ThrowAsync<SqliteException>(() => _goals.AddAsync(goal, CancellationToken.None));
    }

    [Fact]
    public async Task SampleSeed_InsertsMissingCategoriesOnce()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);

        await SampleCategorySeed.ApplyAsync(connection, CancellationToken.None);
        await SampleCategorySeed.ApplyAsync(connection, CancellationToken.None);

        (await _categories.ListAsync(CancellationToken.None)).Count.ShouldBe(4);
    }
}
