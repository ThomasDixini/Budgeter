using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

public sealed class SqliteGoalProgressTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteGoalRepository _goals;
    private readonly SqliteGoalProgressLedger _ledger;

    public SqliteGoalProgressTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _goals = new SqliteGoalRepository(_connections);
        _ledger = new SqliteGoalProgressLedger(_connections);
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

    private async Task AddGoalAsync(GoalDefinition definition) =>
        await _goals.AddAsync(Goal.Create(definition), CancellationToken.None);

    private Task Log(string eventId, DateOnly day, int amount = 1, string goalId = "g1",
        GoalSource source = GoalSource.Manual, string sourceRef = "") =>
        _ledger.RecordAsync(new GoalProgressEvent(eventId, goalId, day, amount, source, sourceRef), CancellationToken.None);

    private async Task<int> DoneOn(DateOnly day, string goalId = "g1") =>
        (await _goals.FindAsync(goalId, day, CancellationToken.None))!.Done;

    [Fact]
    public async Task Weekly_SumsOnlyTheWeekAroundTheDay()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("last-sunday", TestDays.MondayOfThisWeek.AddDays(-1));
        await Log("monday", TestDays.MondayOfThisWeek);
        await Log("sunday", TestDays.MondayOfThisWeek.AddDays(6));
        await Log("next-monday", TestDays.MondayOfThisWeek.AddDays(7));

        (await DoneOn(TestDays.Today), await DoneOn(TestDays.MondayOfThisWeek.AddDays(7)))
            .ShouldBe((2, 1));
    }


    // Entries on 2026-10-28, 2026-10-03 and 2026-11-03: "this period" is the one around 2026-10-28.
    [Theory]
    [InlineData(GoalPeriod.Daily, "2026-10-29", 1, 0)]
    [InlineData(GoalPeriod.Monthly, "2026-11-10", 2, 1)]
    [InlineData(GoalPeriod.Yearly, "2027-01-01", 3, 0)]
    public async Task EachPeriod_StartsOverWhenItEnds(
        GoalPeriod period, string nextPeriodDay, int expectedThisPeriod, int expectedNextPeriod)
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy() with { Period = period });
        await Log("today", TestDays.Today);
        await Log("earlier-this-month", new DateOnly(2026, 10, 3));
        await Log("next-month", new DateOnly(2026, 11, 3));

        (await DoneOn(TestDays.Today), await DoneOn(DateOnly.Parse(nextPeriodDay)))
            .ShouldBe((expectedThisPeriod, expectedNextPeriod));
    }

    [Fact]
    public async Task Custom_CountsEverythingUpToTheDeadline()
    {
        await AddGoalAsync(GoalDefinitions.CourseObjective());
        await Log("early", new DateOnly(2026, 9, 1), goalId: "g2");
        await Log("on-deadline", new DateOnly(2026, 12, 15), goalId: "g2");
        await Log("after", new DateOnly(2026, 12, 16), goalId: "g2");

        (await DoneOn(TestDays.Today, "g2")).ShouldBe(2);
    }

    [Fact]
    public async Task RecordingTheSameEntryIdTwice_CountsOnce()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());

        await Log("e1", TestDays.Today);
        await Log("e1", TestDays.Today);

        (await DoneOn(TestDays.Today)).ShouldBe(1);
    }

    [Fact]
    public async Task ManualEntriesNeverGoBelowZero_AndAutomaticOnesAddOn()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy() with { Tracking = GoalTracking.Blocks });
        await Log("auto", TestDays.Today, source: GoalSource.Block, sourceRef: "weekdays/csharp");
        await Log("manual-back", TestDays.Today, amount: -3);

        (await DoneOn(TestDays.Today)).ShouldBe(1);
    }

    private Task TakeBack(string eventId, DateOnly day, int amount = -1, string goalId = "g1") =>
        _ledger.TakeBackAsync(
            new GoalProgressEvent(eventId, goalId, day, amount, GoalSource.Manual, string.Empty),
            GoalWindow.For(GoalPeriod.Weekly, day, null),
            CancellationToken.None);

    [Fact]
    public async Task TakeBack_RemovesOneOfTheManualEntriesOfThisPeriod()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("manual", TestDays.Today, amount: 2);

        await TakeBack("back", TestDays.Today);

        (await DoneOn(TestDays.Today)).ShouldBe(1);
    }

    [Fact]
    public async Task TakeBack_IgnoresAutomaticEntriesAndOtherWeeks_SoItCannotGoBelowZero()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy() with { Tracking = GoalTracking.Tasks });
        await Log("auto", TestDays.Today, source: GoalSource.Task, sourceRef: "t1");
        await Log("old", TestDays.Today.AddDays(-14));

        await TakeBack("back", TestDays.Today);

        (await DoneOn(TestDays.Today)).ShouldBe(1);
        (await CountEntriesAsync()).ShouldBe(2);
    }

    [Fact]
    public async Task TakeBack_TwoAtOnce_CannotBothPassWithOneRepetitionLeft()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("manual", TestDays.Today);

        await Task.WhenAll(TakeBack("back-1", TestDays.Today), TakeBack("back-2", TestDays.Today));

        (await DoneOn(TestDays.Today)).ShouldBe(0);
        (await CountEntriesAsync()).ShouldBe(2);
    }

    // Entries of another source than the one the goal is tracked from never add up.
    [Fact]
    public async Task OnlyEntriesFromTheCurrentTrackingCount()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy() with { Tracking = GoalTracking.Tasks });
        await Log("from-a-task", TestDays.Today, source: GoalSource.Task, sourceRef: "t1");
        await Log("left-from-blocks", TestDays.Today, source: GoalSource.Block, sourceRef: "weekdays/csharp");

        (await DoneOn(TestDays.Today)).ShouldBe(1);
    }

    private async Task<long> CountEntriesAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var counts = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM goal_progress", reader => reader.GetInt64(0), CancellationToken.None);
        return counts[0];
    }

    [Fact]
    public async Task RemoveBySource_OnlyRemovesThatCompletionOnThatDay()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy() with { Tracking = GoalTracking.Blocks });
        await Log("a", TestDays.Today, source: GoalSource.Block, sourceRef: "weekdays/csharp");
        await Log("b", TestDays.Today.AddDays(-1), source: GoalSource.Block, sourceRef: "weekdays/csharp");
        await Log("c", TestDays.Today, source: GoalSource.Block, sourceRef: "weekdays/other");

        await _ledger.RemoveBySourceAsync(GoalSource.Block, "weekdays/csharp", TestDays.Today, CancellationToken.None);

        (await DoneOn(TestDays.Today)).ShouldBe(2);
    }

    [Fact]
    public async Task RemoveAutomatic_KeepsTheManualEntries()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("manual", TestDays.Today);
        await Log("auto", TestDays.Today, source: GoalSource.Task, sourceRef: "t1");

        await _ledger.RemoveAutomaticAsync("g1", CancellationToken.None);

        (await DoneOn(TestDays.Today)).ShouldBe(1);
    }

    [Fact]
    public async Task Update_ChangesTheDefinitionAndKeepsTheEntries()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("e1", TestDays.Today, amount: 2);

        await _goals.UpdateAsync(
            GoalDefinitions.WeeklyStudy() with { Title = "Renamed", Target = 8, Tracking = GoalTracking.Tasks },
            CancellationToken.None);

        var goal = (await _goals.FindAsync("g1", TestDays.Today, CancellationToken.None))!;
        (goal.Definition.Title, goal.Definition.Target, goal.Definition.Tracking, goal.Done)
            .ShouldBe(("Renamed", 8, GoalTracking.Tasks, 2));
    }

    [Fact]
    public async Task Delete_TakesTheEntriesWithTheGoal()
    {
        await AddGoalAsync(GoalDefinitions.WeeklyStudy());
        await Log("e1", TestDays.Today);

        await _goals.DeleteAsync("g1", CancellationToken.None);

        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var entries = await SqliteCommands.QueryAsync(
            connection, "SELECT COUNT(*) FROM goal_progress", reader => reader.GetInt64(0), CancellationToken.None);
        entries[0].ShouldBe(0);
    }

    [Fact]
    public async Task AnEntryForAnUnknownGoal_IsRejectedByTheForeignKey()
    {
        await Should.ThrowAsync<SqliteException>(() => Log("e1", TestDays.Today, goalId: "missing"));
    }
}
