using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Tasks;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteTaskRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly Today = new(2026, 10, 27);
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteTaskRepository _tasks;

    public SqliteTaskRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _tasks = new SqliteTaskRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await new SqliteCategoryRepository(_connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Save_RoundTripsEveryKindOfRepeat()
    {
        await _tasks.SaveAsync(TaskItem.Create("once", "Call", null, TaskRepeat.Once, [], Today), CancellationToken.None);
        await _tasks.SaveAsync(TaskItem.Create("weekly", "Gym", "study", TaskRepeat.Weekly, [0, 2], null), CancellationToken.None);

        var tasks = await _tasks.ListAsync(CancellationToken.None);

        tasks.Select(task => (task.Id, task.Repeat, task.Date, string.Join(",", task.Days), task.CategoryId))
            .ShouldBe([("once", TaskRepeat.Once, Today, "", null), ("weekly", TaskRepeat.Weekly, null, "0,2", "study")]);
    }

    [Fact]
    public async Task Save_ReplacesTheStoredTask()
    {
        await _tasks.SaveAsync(TaskItem.Create("t1", "Read", null, TaskRepeat.Daily, [], null), CancellationToken.None);

        await _tasks.SaveAsync(TaskItem.Create("t1", "Read more", null, TaskRepeat.Daily, [], null), CancellationToken.None);

        (await _tasks.FindAsync("t1", CancellationToken.None))!.Title.ShouldBe("Read more");
    }

    [Fact]
    public async Task Completions_AreKeptPerDayAndGoWithTheTask()
    {
        await _tasks.SaveAsync(TaskItem.Create("t1", "Read", null, TaskRepeat.Daily, [], null), CancellationToken.None);
        await _tasks.SetCompletedAsync("t1", Today, isDone: true, CancellationToken.None);
        await _tasks.SetCompletedAsync("t1", Today, isDone: true, CancellationToken.None);

        var today = await _tasks.ListCompletedAsync(Today, CancellationToken.None);
        var tomorrow = await _tasks.ListCompletedAsync(Today.AddDays(1), CancellationToken.None);
        await _tasks.DeleteAsync("t1", CancellationToken.None);

        (today.Count, tomorrow.Count).ShouldBe((1, 0));
        (await _tasks.ListCompletedAsync(Today, CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task SampleSeed_InsertsTasksOnlyIntoAnEmptyTable()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SampleCategorySeed.ApplyAsync(connection, CancellationToken.None);
        await SampleTaskSeed.ApplyAsync(connection, CancellationToken.None);
        await _tasks.DeleteAsync("t1", CancellationToken.None);

        await SampleTaskSeed.ApplyAsync(connection, CancellationToken.None);

        (await _tasks.ListAsync(CancellationToken.None)).Count.ShouldBe(4);
    }
}
