using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteCategoryDeletionTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteCategoryRepository _categories;
    private readonly SqliteRoutineRepository _routines;
    private readonly SqliteGoalRepository _goals;

    public SqliteCategoryDeletionTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _categories = new SqliteCategoryRepository(_connections);
        _routines = new SqliteRoutineRepository(_connections);
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
    public async Task Update_ReplacesNameAndColor()
    {
        await _categories.UpdateAsync(Category.Create("study", "Learning", "#F0ABFC"), CancellationToken.None);

        var stored = await _categories.FindAsync("study", CancellationToken.None);

        (stored!.Name, stored.Color).ShouldBe(("Learning", "#F0ABFC"));
    }

    [Fact]
    public async Task Delete_RemovesGoalsAndDetachesBlocks()
    {
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        var definition = GoalDefinitions.CourseObjective();
        await _goals.AddAsync(Goal.Create(definition), CancellationToken.None);

        await _categories.DeleteAsync("study", CancellationToken.None);

        (await _categories.FindAsync("study", CancellationToken.None)).ShouldBeNull();
        (await _goals.FindAsync(definition.Id, TestDays.Today, CancellationToken.None)).ShouldBeNull();
        var blocks = (await _routines.ListAsync(CancellationToken.None)).Single().Blocks;
        blocks.ShouldAllBe(block => block.CategoryId == null);
    }
}
