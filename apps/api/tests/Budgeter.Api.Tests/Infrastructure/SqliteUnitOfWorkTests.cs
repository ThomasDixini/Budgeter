using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Infrastructure.Sqlite;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>A completed block and the goal progress it earns are stored together or not at all.</summary>
public sealed class SqliteUnitOfWorkTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly Today = TestDays.Today;
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteUnitOfWork _unitOfWork;
    private readonly SqliteBlockOutcomeRepository _outcomes;
    private readonly SqliteRoutineRepository _routines;
    private readonly SqliteGoalRepository _goals;

    public SqliteUnitOfWorkTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _unitOfWork = new SqliteUnitOfWork(_connections);
        _outcomes = new SqliteBlockOutcomeRepository(_connections);
        _routines = new SqliteRoutineRepository(_connections);
        _goals = new SqliteGoalRepository(_connections);
    }

    public async Task InitializeAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        await new SqliteCategoryRepository(_connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        await _routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    private RecordBlockOutcome Record(IGoalProgressLedger ledger) =>
        new(_outcomes, _routines, new GoalCredits(_goals, ledger), _unitOfWork);

    private UndoBlockOutcome Undo(IGoalProgressLedger ledger) =>
        new(_outcomes, new GoalCredits(_goals, ledger), _unitOfWork);

    private static RecordBlockOutcomeCommand CompleteCsharp() =>
        new("weekdays", "csharp", Today, BlockOutcomeKind.Done, "14:50");

    private async Task<int> DoneAsync() => (await _goals.FindAsync("g1", Today, CancellationToken.None))!.Done;

    [Fact]
    public async Task Record_StoresTheOutcomeAndItsCredit()
    {
        await Record(new SqliteGoalProgressLedger(_connections)).ExecuteAsync(CompleteCsharp(), CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).Count.ShouldBe(1);
        (await DoneAsync()).ShouldBe(1);
    }

    // Regression: the outcome was saved, then crediting the goal failed, and the block stayed done
    // without counting toward its goal.
    [Fact]
    public async Task Record_StoresNoOutcomeWhenCreditingItsGoalFails()
    {
        await Should.ThrowAsync<IOException>(() =>
            Record(new UnreachableGoalProgressLedger()).ExecuteAsync(CompleteCsharp(), CancellationToken.None));

        (await _outcomes.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Undo_KeepsTheOutcomeWhenTakingBackItsCreditFails()
    {
        await Record(new SqliteGoalProgressLedger(_connections)).ExecuteAsync(CompleteCsharp(), CancellationToken.None);

        await Should.ThrowAsync<IOException>(() =>
            Undo(new UnreachableGoalProgressLedger()).ExecuteAsync("weekdays", "csharp", Today, CancellationToken.None));

        (await _outcomes.ListAsync(Today, CancellationToken.None)).Count.ShouldBe(1);
        (await DoneAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task ARepositoryTransaction_JoinsTheUnitOfWorkAndRollsBackWithIt()
    {
        var weekend = Routine.Create("weekend", "Weekend", [5, 6], "09:00", "14:00", []);

        await Should.ThrowAsync<IOException>(() => _unitOfWork.RunAsync(async () =>
        {
            await _routines.SaveAsync(weekend, CancellationToken.None);
            throw new IOException("Expected the work to finish, received a simulated failure");
        }, CancellationToken.None));

        (await _routines.ListAsync(CancellationToken.None)).Select(routine => routine.Id).ShouldBe(["weekdays"]);
    }
}
