using Orbit.Api.Domain.Categories;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>The sample data reaches a database once, and what the user deletes stays deleted.</summary>
public sealed class SampleDataTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteCategoryRepository _categories;

    public SampleDataTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _categories = new SqliteCategoryRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    /// <summary>What the API does on every start with sample data turned on.</summary>
    private async Task StartAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SampleData.ApplyOnceAsync(connection, CancellationToken.None);
    }

    [Fact]
    public async Task AFreshDatabase_GetsTheSampleCategoriesRoutinesAndTasks()
    {
        await StartAsync();

        (await _categories.ListAsync(CancellationToken.None)).Count.ShouldBe(4);
        (await new SqliteRoutineRepository(_connections).ListAsync(CancellationToken.None)).Count.ShouldBe(2);
        (await new SqliteTaskRepository(_connections).ListAsync(CancellationToken.None)).Count.ShouldBe(5);
    }

    // Regression: the sample categories were inserted again on every start, so a deleted one came back.
    [Fact]
    public async Task ADeletedSampleCategory_DoesNotComeBackOnTheNextStart()
    {
        await StartAsync();
        await _categories.DeleteAsync("study", CancellationToken.None);

        await StartAsync();

        (await _categories.FindAsync("study", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task EveryRoutineDeleted_DoesNotBringTheSamplesBack()
    {
        await StartAsync();
        var routines = new SqliteRoutineRepository(_connections);
        await routines.DeleteAsync("weekdays", CancellationToken.None);
        await routines.DeleteAsync("weekend", CancellationToken.None);

        await StartAsync();

        (await routines.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ADatabaseAlreadyInUse_IsNotSeeded()
    {
        await _categories.AddAsync(Category.Create("languages", "Languages", "#86EFAC"), CancellationToken.None);

        await StartAsync();

        (await _categories.ListAsync(CancellationToken.None)).Select(category => category.Id).ShouldBe(["languages"]);
    }
}
