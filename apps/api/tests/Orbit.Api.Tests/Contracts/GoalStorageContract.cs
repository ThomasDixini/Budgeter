using Orbit.Api.Application.Goals;
using Orbit.Api.Domain.Categories;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Infrastructure.Sqlite;
using Orbit.Api.Tests.Fakes;
using Orbit.Api.Tests.Infrastructure;
using Shouldly;

namespace Orbit.Api.Tests.Contracts;

/// <summary>
/// What every goal storage must do, run against both the SQLite adapter and the in-memory fake the use
/// case tests rely on, so the fake cannot drift from the real thing unnoticed.
/// </summary>
public abstract class GoalStorageContract : IAsyncLifetime
{
    private static readonly DateOnly Monday = TestDays.MondayOfThisWeek;

    protected IGoalRepository Goals { get; set; } = null!;
    protected IGoalProgressLedger Ledger { get; set; } = null!;

    /// <summary>Sets <see cref="Goals"/> and <see cref="Ledger"/> on empty storage with a "study" category.</summary>
    public abstract Task InitializeAsync();

    public virtual Task DisposeAsync() => Task.CompletedTask;

    private Task LogAsync(string eventId, DateOnly day, string goalId = "g1", string sourceRef = "weekdays/csharp") =>
        Ledger.RecordAsync(new GoalProgressEvent(eventId, goalId, day, 1, GoalSource.Block, sourceRef), CancellationToken.None);

    private async Task<Goal> FindAsync(string goalId, DateOnly day) =>
        (await Goals.FindAsync(goalId, day, CancellationToken.None))!;

    [Fact]
    public async Task Add_StoresTheGoalWithNoProgress()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        var stored = await FindAsync("g1", TestDays.Today);

        (stored.Definition, stored.Done).ShouldBe((Goal.Create(GoalDefinitions.WeeklyStudy()).Definition, 0));
    }

    [Fact]
    public async Task Add_StoresAnIdOnceAndSaysSo()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        var added = await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 9 }), CancellationToken.None);

        (added, (await FindAsync("g1", TestDays.Today)).Definition.Target).ShouldBe((false, 5));
    }

    [Fact]
    public async Task Find_AnswersNullForAnUnknownId()
    {
        (await Goals.FindAsync("missing", TestDays.Today, CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Progress_CountsTheEntriesOfThePeriodAroundTheDay_Once()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await LogAsync("last-week", Monday.AddDays(-1));
        await LogAsync("this-week", Monday);
        await LogAsync("this-week", Monday);

        (await FindAsync("g1", TestDays.Today)).Done.ShouldBe(1);
    }

    [Fact]
    public async Task List_ReturnsEveryGoalInCreationOrderWithItsOwnProgress()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy("g2")), CancellationToken.None);
        await LogAsync("g2-entry", TestDays.Today, goalId: "g2");

        var goals = await Goals.ListAsync(TestDays.Today, CancellationToken.None);

        goals.Select(goal => (goal.Id, goal.Done)).ShouldBe([("g1", 0), ("g2", 1)]);
    }

    [Fact]
    public async Task RemoveBySource_TakesBackOnlyThatDay()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await LogAsync("monday", Monday);
        await LogAsync("today", TestDays.Today);

        await Ledger.RemoveBySourceAsync(GoalSource.Block, "weekdays/csharp", TestDays.Today, CancellationToken.None);

        (await FindAsync("g1", TestDays.Today)).Done.ShouldBe(1);
    }

    [Fact]
    public async Task Achievements_CountForTheirPeriodAndAreTakenBackInsideTheWindowOnly()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyObjective()), CancellationToken.None);
        var nextMonday = Monday.AddDays(7);
        await LogAsync(GoalAchievement.EntryId("g5", Monday), Monday, "g5", GoalAchievement.SourceRef);
        await LogAsync(GoalAchievement.EntryId("g5", nextMonday), nextMonday, "g5", GoalAchievement.SourceRef);

        await Ledger.RemoveAchievementsAsync("g5", GoalWindow.For(GoalPeriod.Weekly, nextMonday, null), CancellationToken.None);

        ((await FindAsync("g5", TestDays.Today)).AchievedOn, (await FindAsync("g5", nextMonday)).AchievedOn)
            .ShouldBe((Monday, (DateOnly?)null));
    }

    [Fact]
    public async Task Update_ChangesTheDefinitionAndKeepsTheProgress()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await LogAsync("today", TestDays.Today);

        await Goals.UpdateAsync(Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 2 }).Definition, CancellationToken.None);

        var stored = await FindAsync("g1", TestDays.Today);
        (stored.Definition.Target, stored.Done).ShouldBe((2, 1));
    }

    [Fact]
    public async Task Delete_TakesTheProgressWithTheGoal()
    {
        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);
        await LogAsync("today", TestDays.Today);
        await Goals.DeleteAsync("g1", CancellationToken.None);

        await Goals.AddAsync(Goal.Create(GoalDefinitions.WeeklyStudy()), CancellationToken.None);

        (await FindAsync("g1", TestDays.Today)).Done.ShouldBe(0);
    }
}

public sealed class InMemoryGoalStorageTests : GoalStorageContract
{
    public override Task InitializeAsync()
    {
        var storage = new InMemoryGoalRepository();
        (Goals, Ledger) = (storage, storage);
        return Task.CompletedTask;
    }
}

public sealed class SqliteGoalStorageTests : GoalStorageContract, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();

    public override async Task InitializeAsync()
    {
        var connections = TestUsers.FactoryFor(_database);
        await TestUsers.CreateSchemaAsync(connections);
        await new SqliteCategoryRepository(connections)
            .AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        (Goals, Ledger) = (new SqliteGoalRepository(connections), new SqliteGoalProgressLedger(connections));
    }

    public void Dispose() => _database.Dispose();
}
