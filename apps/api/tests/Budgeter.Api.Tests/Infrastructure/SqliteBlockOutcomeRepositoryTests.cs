using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteBlockOutcomeRepositoryTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly Today = new(2026, 10, 27);
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteBlockOutcomeRepository _outcomes;
    private readonly SqliteRoutineRepository _routines;

    public SqliteBlockOutcomeRepositoryTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _outcomes = new SqliteBlockOutcomeRepository(_connections);
        _routines = new SqliteRoutineRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await new SqliteCategoryRepository(_connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private static BlockOutcome Outcome(string blockId, BlockOutcomeKind kind, string at) =>
        BlockOutcome.Create("weekdays", blockId, Today, kind, at);

    [Fact]
    public async Task Save_RoundTripsInRecordedOrderAndReplacesPerBlock()
    {
        await _outcomes.SaveAsync(Outcome("work", BlockOutcomeKind.Done, "11:20"), CancellationToken.None);
        await _outcomes.SaveAsync(Outcome("csharp", BlockOutcomeKind.Skipped, "13:40"), CancellationToken.None);
        await _outcomes.SaveAsync(Outcome("work", BlockOutcomeKind.Skipped, "11:25"), CancellationToken.None);

        var outcomes = await _outcomes.ListAsync(Today, CancellationToken.None);

        outcomes.Select(outcome => (outcome.BlockId, outcome.Kind, outcome.At))
            .ShouldBe([("work", BlockOutcomeKind.Skipped, "11:25"), ("csharp", BlockOutcomeKind.Skipped, "13:40")]);
    }

    [Fact]
    public async Task Delete_RemovesOnlyThatBlockOnThatDay()
    {
        await _outcomes.SaveAsync(Outcome("work", BlockOutcomeKind.Done, "11:20"), CancellationToken.None);
        await _outcomes.SaveAsync(Outcome("csharp", BlockOutcomeKind.Done, "14:00"), CancellationToken.None);

        await _outcomes.DeleteAsync("weekdays", "work", Today, CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).Single().BlockId.ShouldBe("csharp");
    }

    // Saving a routine rewrites its block rows; the day's history must survive that.
    [Fact]
    public async Task Outcomes_SurviveSavingTheRoutineAgain()
    {
        await _outcomes.SaveAsync(Outcome("work", BlockOutcomeKind.Done, "11:20"), CancellationToken.None);

        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task Outcomes_GoWithTheirRoutine()
    {
        await _outcomes.SaveAsync(Outcome("work", BlockOutcomeKind.Done, "11:20"), CancellationToken.None);

        await _routines.DeleteAsync("weekdays", CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
    }
}
