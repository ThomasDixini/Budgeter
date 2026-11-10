using Orbit.Api.Application.Routines;
using Orbit.Api.Domain.Categories;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Domain.Routines;
using Orbit.Api.Domain.Tasks;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>The repositories of the planner module, acting for one user over a shared database.</summary>
internal sealed class PlannerStorage(SqliteConnectionFactory connections)
{
    public SqliteCategoryRepository Categories { get; } = new(connections);
    public SqliteGoalRepository Goals { get; } = new(connections);
    public SqliteGoalProgressLedger Ledger { get; } = new(connections);
    public SqliteRoutineRepository Routines { get; } = new(connections);
    public SqliteRoutineRotationRepository Rotations { get; } = new(connections);
    public SqliteBlockOutcomeRepository Outcomes { get; } = new(connections);
    public SqliteTaskRepository Tasks { get; } = new(connections);
    public SqliteUnitOfWork UnitOfWork { get; } = new(connections);
}

/// <summary>
/// Two users store the very same ids in one database: each sees, changes and deletes only its own rows.
/// </summary>
public sealed class SqlitePlannerIsolationTests : IAsyncLifetime, IDisposable
{
    private static readonly DateOnly Today = TestDays.Today;
    private static readonly DateOnly Monday = new(2026, 11, 2);
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly PlannerStorage _mine;
    private readonly PlannerStorage _theirs;

    public SqlitePlannerIsolationTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _mine = new PlannerStorage(_connections);
        _theirs = new PlannerStorage(TestUsers.FactoryFor(_database, TestUsers.OtherId));
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        foreach (var planner in new[] { _mine, _theirs })
        {
            await planner.Categories.AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        }
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task Categories_AreListedAndFoundOnlyForTheirOwner()
    {
        await _mine.Categories.AddAsync(Category.Create("mine", "Mine", "#86EFAC"), CancellationToken.None);

        (await _mine.Categories.ListAsync(CancellationToken.None)).Select(category => category.Id)
            .ShouldBe(["study", "mine"]);
        (await _theirs.Categories.ListAsync(CancellationToken.None)).Select(category => category.Id)
            .ShouldBe(["study"]);
        (await _theirs.Categories.FindAsync("mine", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Categories_UpdatingOneUsersCategoryLeavesTheOthersName()
    {
        await _mine.Categories.UpdateAsync(Category.Create("study", "Renamed", "#F0ABFC"), CancellationToken.None);

        (await _theirs.Categories.FindAsync("study", CancellationToken.None))!.Name.ShouldBe("Study");
    }

    [Fact]
    public async Task Categories_DeletingOneUsersCategoryKeepsTheOthersGoalsAndTasks()
    {
        await _mine.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _theirs.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _theirs.Tasks.SaveAsync(TaskItem.Create("t1", "Read", "study", TaskRepeat.Daily, [], null), CancellationToken.None);
        await _theirs.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        await _mine.Categories.DeleteAsync("study", CancellationToken.None);

        (await _mine.Goals.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Goals.ListAsync(Today, CancellationToken.None)).Count.ShouldBe(1);
        (await _theirs.Tasks.FindAsync("t1", CancellationToken.None))!.CategoryId.ShouldBe("study");
        (await _theirs.Routines.FindAsync("weekdays", CancellationToken.None))!.Blocks[1].CategoryId.ShouldBe("study");
    }

    [Fact]
    public async Task Goals_SameIdKeepsEachUsersTitleAndTarget()
    {
        await _mine.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        var addedForOther = await _theirs.Goals.AddAsync(
            Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 9 }), CancellationToken.None);

        addedForOther.ShouldBeTrue();
        (await _mine.Goals.FindAsync("g1", Today, CancellationToken.None))!.Definition.Target.ShouldBe(5);
        (await _theirs.Goals.FindAsync("g1", Today, CancellationToken.None))!.Definition.Target.ShouldBe(9);
    }

    [Fact]
    public async Task Goals_UpdatingAndDeletingNeverReachTheOtherUsersGoal()
    {
        await _mine.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _theirs.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        await _mine.Goals.UpdateAsync(GoalDefinitions.WeeklyStudy() with { Target = 7 }, CancellationToken.None);
        (await _theirs.Goals.FindAsync("g1", Today, CancellationToken.None))!.Definition.Target.ShouldBe(5);
        await _mine.Goals.DeleteAsync("g1", CancellationToken.None);

        (await _mine.Goals.FindAsync("g1", Today, CancellationToken.None)).ShouldBeNull();
        (await _theirs.Goals.FindAsync("g1", Today, CancellationToken.None)).ShouldNotBeNull();
    }

    [Fact]
    public async Task GoalProgress_IsCountedOnlyForTheUserWhoLoggedIt()
    {
        await _mine.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _theirs.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        await _mine.Ledger.RecordAsync(Entry("e1", amount: 2), CancellationToken.None);
        await _theirs.Ledger.RecordAsync(Entry("e1", amount: 3), CancellationToken.None);

        (await _mine.Goals.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(2);
        (await _theirs.Goals.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(3);
    }

    [Fact]
    public async Task GoalProgress_RemovingBySourceLeavesTheOtherUsersEntry()
    {
        await _mine.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _theirs.Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await _mine.Ledger.RecordAsync(Entry("e1", amount: 1), CancellationToken.None);
        await _theirs.Ledger.RecordAsync(Entry("e1", amount: 1), CancellationToken.None);

        await _mine.Ledger.RemoveBySourceAsync(GoalSource.Block, "weekdays/csharp", Today, CancellationToken.None);

        (await _mine.Goals.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(0);
        (await _theirs.Goals.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(1);
    }

    [Fact]
    public async Task Routines_SameIdKeepsEachUsersBlocks()
    {
        await _mine.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _theirs.Routines.SaveAsync(
            Routine.Create("weekdays", "Theirs", [5], "09:00", "10:00", []), CancellationToken.None);

        (await _mine.Routines.FindAsync("weekdays", CancellationToken.None))!.Blocks.Count.ShouldBe(2);
        (await _theirs.Routines.FindAsync("weekdays", CancellationToken.None))!.Blocks.ShouldBeEmpty();
        (await _theirs.Routines.ListAsync(CancellationToken.None)).Single().Name.ShouldBe("Theirs");
    }

    [Fact]
    public async Task Routines_DeletingOneUsersRoutineKeepsTheOthersWithItsBlocks()
    {
        await _mine.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _theirs.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);

        await _mine.Routines.DeleteAsync("weekdays", CancellationToken.None);

        (await _mine.Routines.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Routines.FindAsync("weekdays", CancellationToken.None))!.Blocks.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Rotation_EachUserKeepsItsOwnStartAndSteps()
    {
        await SaveWeekdaysForBothAsync();

        await _mine.Rotations.ReplaceAsync(Rotation(Monday, ("weekdays", 2)), CancellationToken.None);
        await _theirs.Rotations.ReplaceAsync(Rotation(Monday.AddDays(7), ("weekdays", 1)), CancellationToken.None);

        var mine = await _mine.Rotations.GetAsync(CancellationToken.None);
        var theirs = await _theirs.Rotations.GetAsync(CancellationToken.None);
        (mine.StartsOn, mine.Steps.Single().Weeks).ShouldBe((Monday, 2));
        (theirs.StartsOn, theirs.Steps.Single().Weeks).ShouldBe((Monday.AddDays(7), 1));
    }

    [Fact]
    public async Task Rotation_ReplacingOneUsersRotationLeavesTheOthersUntouched()
    {
        await SaveWeekdaysForBothAsync();
        await _theirs.Rotations.ReplaceAsync(Rotation(Monday, ("weekdays", 4)), CancellationToken.None);

        await _mine.Rotations.ReplaceAsync(Rotation(Monday, ("weekdays", 1)), CancellationToken.None);

        (await _theirs.Rotations.GetAsync(CancellationToken.None)).Steps.Single().Weeks.ShouldBe(4);
        (await new PlannerStorage(TestUsers.FactoryFor(_database, "nobody")).Rotations.GetAsync(CancellationToken.None))
            .ShouldBeSameAs(RoutineRotation.Empty);
    }

    [Fact]
    public async Task Outcomes_SameBlockAndDayAreStoredPerUser()
    {
        await SaveWeekdaysForBothAsync();

        await _mine.Outcomes.SaveAsync(Outcome(BlockOutcomeKind.Done, "11:20"), CancellationToken.None);
        await _theirs.Outcomes.SaveAsync(Outcome(BlockOutcomeKind.Skipped, "11:30"), CancellationToken.None);

        (await _mine.Outcomes.ListAsync(Today, CancellationToken.None)).Single().Kind.ShouldBe(BlockOutcomeKind.Done);
        (await _theirs.Outcomes.ListAsync(Today, CancellationToken.None)).Single().Kind.ShouldBe(BlockOutcomeKind.Skipped);
    }

    [Fact]
    public async Task Outcomes_DeletingOneUsersOutcomeKeepsTheOthers()
    {
        await SaveWeekdaysForBothAsync();
        await _mine.Outcomes.SaveAsync(Outcome(BlockOutcomeKind.Done, "11:20"), CancellationToken.None);
        await _theirs.Outcomes.SaveAsync(Outcome(BlockOutcomeKind.Done, "11:20"), CancellationToken.None);

        await _mine.Outcomes.DeleteAsync("weekdays", "work", Today, CancellationToken.None);

        (await _mine.Outcomes.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Outcomes.ListAsync(Today, CancellationToken.None)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task Tasks_SameIdIsStoredPerUserAndDeletedPerUser()
    {
        await _mine.Tasks.SaveAsync(TaskItem.Create("t1", "Mine", null, TaskRepeat.Daily, [], null), CancellationToken.None);
        await _theirs.Tasks.SaveAsync(TaskItem.Create("t1", "Theirs", null, TaskRepeat.Daily, [], null), CancellationToken.None);

        await _mine.Tasks.DeleteAsync("t1", CancellationToken.None);

        (await _mine.Tasks.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Tasks.FindAsync("t1", CancellationToken.None))!.Title.ShouldBe("Theirs");
    }

    [Fact]
    public async Task TaskCompletions_AreMarkedAndClearedPerUser()
    {
        await _mine.Tasks.SaveAsync(TaskItem.Create("t1", "Read", null, TaskRepeat.Daily, [], null), CancellationToken.None);
        await _theirs.Tasks.SaveAsync(TaskItem.Create("t1", "Read", null, TaskRepeat.Daily, [], null), CancellationToken.None);
        await _mine.Tasks.SetCompletedAsync("t1", Today, isDone: true, CancellationToken.None);
        await _theirs.Tasks.SetCompletedAsync("t1", Today, isDone: true, CancellationToken.None);

        await _mine.Tasks.SetCompletedAsync("t1", Today, isDone: false, CancellationToken.None);

        (await _mine.Tasks.ListCompletedAsync(Today, CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Tasks.ListCompletedAsync(Today, CancellationToken.None)).ShouldBe(["t1"]);
    }

    [Fact]
    public async Task UnitOfWork_RollsBackOnlyTheRunningUsersWrites()
    {
        await _theirs.Tasks.SaveAsync(TaskItem.Create("t1", "Theirs", null, TaskRepeat.Daily, [], null), CancellationToken.None);

        await Should.ThrowAsync<IOException>(() => _mine.UnitOfWork.RunAsync(async () =>
        {
            await _mine.Tasks.SaveAsync(TaskItem.Create("t1", "Mine", null, TaskRepeat.Daily, [], null), CancellationToken.None);
            throw new IOException("Expected the work to finish, received a simulated failure");
        }, CancellationToken.None));

        (await _mine.Tasks.ListAsync(CancellationToken.None)).ShouldBeEmpty();
        (await _theirs.Tasks.FindAsync("t1", CancellationToken.None))!.Title.ShouldBe("Theirs");
    }

    [Fact]
    public async Task UnitOfWork_CommitsTheUsersWrites()
    {
        await _theirs.UnitOfWork.RunAsync(
            () => _theirs.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None), CancellationToken.None);

        (await _theirs.Routines.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
        (await _mine.Routines.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    private async Task SaveWeekdaysForBothAsync()
    {
        await _mine.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
        await _theirs.Routines.SaveAsync(Routines.Weekdays(), CancellationToken.None);
    }

    private static GoalProgressEvent Entry(string eventId, int amount) =>
        new(eventId, "g1", Today, amount, GoalSource.Block, "weekdays/csharp");

    private static BlockOutcome Outcome(BlockOutcomeKind kind, string at) =>
        BlockOutcome.Create("weekdays", "work", Today, kind, at);

    private static RoutineRotation Rotation(DateOnly startsOn, params (string RoutineId, int Weeks)[] steps) =>
        RoutineRotation.Create(startsOn, steps.Select(step => RotationStep.Create(step.RoutineId, step.Weeks)).ToList());
}
