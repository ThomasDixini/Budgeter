using Orbit.Api.Domain.Categories;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

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
        _connections = TestUsers.FactoryFor(_database);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private async Task StoreAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(connection, sql, CancellationToken.None,
            ("$user", TestUsers.DefaultId), ("$text", LongerThanAnyLimit));
    }

    [Fact]
    public async Task ACategoryNamedLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO categories (user_id, id, name, color) VALUES ($user, 'old', $text, '#7DD3FC')");

        var categories = await new SqliteCategoryRepository(_connections).ListAsync(CancellationToken.None);

        categories.Single().Name.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task AGoalTitledLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO categories (user_id, id, name, color) VALUES ($user, 'study', 'Study', '#7DD3FC')");
        await StoreAsync(
            """
            INSERT INTO goals (user_id, id, category_id, title, type, period, target, tracking)
            VALUES ($user, 'g1', 'study', $text, 'frequency', 'weekly', 5, 'blocks')
            """);

        var goals = await new SqliteGoalRepository(_connections).ListAsync(TestDays.Today, CancellationToken.None);

        goals.Single().Definition.Title.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task ARoutineBlockNamedLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO routines (user_id, id, name, days, start_time, end_time) VALUES ($user, 'r1', 'Day', '0', '08:00', '17:00')");
        await StoreAsync(
            """
            INSERT INTO routine_blocks (user_id, routine_id, id, position, name, start_time, end_time)
            VALUES ($user, 'r1', 'b1', 0, $text, '08:00', '09:00')
            """);

        var routines = await new SqliteRoutineRepository(_connections).ListAsync(CancellationToken.None);

        routines.Single().Blocks.Single().Name.ShouldBe(LongerThanAnyLimit);
    }

    [Fact]
    public async Task ATaskTitledLongerThanTodaysLimit_StillLists()
    {
        await StoreAsync("INSERT INTO tasks (user_id, id, title, repeat, days) VALUES ($user, 't1', $text, 'daily', '')");

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
