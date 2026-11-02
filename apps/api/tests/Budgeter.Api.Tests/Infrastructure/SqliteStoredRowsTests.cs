using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>
/// Rows written under looser rules still read once a rule gets stricter: reading one used to throw,
/// and that single row broke the whole list.
/// </summary>
public sealed class SqliteStoredRowsTests : IAsyncLifetime, IDisposable
{
    private static readonly string LongerThanAnyLimit = new('x', 120);
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;

    public SqliteStoredRowsTests()
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

    private async Task StoreAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(connection, sql, CancellationToken.None, ("$text", LongerThanAnyLimit));
    }

    [Fact]
    public async Task ACategoryNamedLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO categories (id, name, color) VALUES ('old', $text, '#7DD3FC')");

        var categories = await new SqliteCategoryRepository(_connections).ListAsync(CancellationToken.None);

        categories.Single().Name.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task AGoalTitledLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO categories (id, name, color) VALUES ('study', 'Study', '#7DD3FC')");
        await StoreAsync(
            """
            INSERT INTO goals (id, category_id, title, type, period, target, tracking)
            VALUES ('g1', 'study', $text, 'frequency', 'weekly', 5, 'blocks')
            """);

        var goals = await new SqliteGoalRepository(_connections).ListAsync(TestDays.Today, CancellationToken.None);

        goals.Single().Definition.Title.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task ARoutineBlockNamedLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO routines (id, name, days, start_time, end_time) VALUES ('r1', 'Day', '0', '08:00', '17:00')");
        await StoreAsync(
            """
            INSERT INTO routine_blocks (routine_id, id, position, name, start_time, end_time)
            VALUES ('r1', 'b1', 0, $text, '08:00', '09:00')
            """);

        var routines = await new SqliteRoutineRepository(_connections).ListAsync(CancellationToken.None);

        routines.Single().Blocks.Single().Name.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task ATaskTitledLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO tasks (id, title, repeat, days) VALUES ('t1', $text, 'daily', '')");

        var tasks = await new SqliteTaskRepository(_connections).ListAsync(CancellationToken.None);

        tasks.Single().Title.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task Add_StoresNothingAndSaysSoWhenTheIdIsTaken()
    {
        var categories = new SqliteCategoryRepository(_connections);
        await categories.AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);

        var added = await categories.AddAsync(Category.Create("study", "Other", "#F0ABFC"), CancellationToken.None);

        added.ShouldBeFalse();
        (await categories.FindAsync("study", CancellationToken.None))!.Name.ShouldBe("Study");
    }

    [Fact]
    public async Task AddGoal_StoresNothingAndSaysSoWhenTheIdIsTaken()
    {
        await new SqliteCategoryRepository(_connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        var goals = new SqliteGoalRepository(_connections);
        await goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        var added = await goals.AddAsync(
            Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 9 }), CancellationToken.None);

        added.ShouldBeFalse();
        (await goals.FindAsync("g1", TestDays.Today, CancellationToken.None))!.Definition.Target.ShouldBe(5);
    }
}
