using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteRoutineRepositoryTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteRoutineRepository _routines;

    public SqliteRoutineRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _routines = new SqliteRoutineRepository(_connections);
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
    public async Task Save_RoundTripsEveryFieldInBlockOrder()
    {
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        var stored = (await _routines.ListAsync(CancellationToken.None)).Single();

        stored.Days.ShouldBe([0, 1, 2, 3, 4]);
        (stored.Start, stored.End).ShouldBe(("08:00", "17:00"));
        stored.Blocks.Select(block => (block.Id, block.Name, block.Start, block.End, block.CategoryId))
            .ShouldBe([("work", "Work", "08:00", "12:00", null), ("csharp", "C# study", "13:30", "15:00", "study")]);
    }

    [Fact]
    public async Task Save_ReplacesBlocksAndKeepsTheRoutinePosition()
    {
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _routines.SaveAsync(Routine.Create("weekend", "Weekend", [5, 6], "09:00", "14:00", []), CancellationToken.None);
        var edited = Routine.Create("weekdays", "Workdays", [0], "09:00", "18:00",
            [RoutineBlock.Create("gym", "Gym", "17:00", "18:00", null)]);

        await _routines.SaveAsync(edited, CancellationToken.None);

        var routines = await _routines.ListAsync(CancellationToken.None);
        routines.Select(routine => routine.Name).ShouldBe(["Workdays", "Weekend"]);
        routines[0].Blocks.Select(block => block.Id).ShouldBe(["gym"]);
    }

    [Fact]
    public async Task Save_UnknownCategoryFailsAndLeavesTheStoredRoutineIntact()
    {
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        await Should.ThrowAsync<SqliteException>(() =>
            _routines.SaveAsync(Routines.Weekdays(studyCategoryId: "missing"), CancellationToken.None));

        var stored = (await _routines.ListAsync(CancellationToken.None)).Single();
        stored.Blocks.Select(block => block.CategoryId).ShouldBe([null, "study"]);
    }

    [Fact]
    public async Task Delete_RemovesTheRoutineAndItsBlocks()
    {
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        await _routines.DeleteAsync("weekdays", CancellationToken.None);

        (await _routines.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var blocks = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM routine_blocks", reader => reader.GetInt64(0), CancellationToken.None);
        blocks[0].ShouldBe(0);
    }

    [Fact]
    public async Task SampleSeed_InsertsRoutinesOnlyIntoAnEmptyTable()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SampleCategorySeed.ApplyAsync(connection, CancellationToken.None);
        await SampleRoutineSeed.ApplyAsync(connection, CancellationToken.None);
        var weekdays = (await _routines.ListAsync(CancellationToken.None))[0];
        await _routines.SaveAsync(
            Routine.Create(weekdays.Id, weekdays.Name, weekdays.Days, weekdays.Start, weekdays.End, []),
            CancellationToken.None);

        await SampleRoutineSeed.ApplyAsync(connection, CancellationToken.None);

        var routines = await _routines.ListAsync(CancellationToken.None);
        routines.Select(routine => routine.Id).ShouldBe(["weekdays", "weekend"]);
        routines[0].Blocks.ShouldBeEmpty();
    }
}
