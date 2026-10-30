using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Domain.Tasks;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

/// <summary>Completing routine blocks feeds the frequency goals of their category.</summary>
public class GoalCreditsTests
{
    private static readonly DateOnly Today = TestDays.Today;
    private readonly InMemoryGoalRepository _goals;
    private readonly InMemoryBlockOutcomeRepository _outcomes = new();
    private readonly InMemoryRoutineRepository _routines = new(Routine.Create(
        "weekdays", "Weekdays", [0, 1, 2, 3, 4], "08:00", "17:00",
        [
            RoutineBlock.Create("work", "Work", "08:00", "12:00", null),
            RoutineBlock.Create("csharp", "C# study", "13:00", "14:00", "study"),
            RoutineBlock.Create("linq", "LINQ", "14:00", "15:00", "study"),
            RoutineBlock.Create("docs", "Docs", "15:00", "16:00", "study"),
        ]));

    public GoalCreditsTests()
    {
        _goals = new InMemoryGoalRepository(
            Goal.Create(GoalDefinitions.WeeklyStudy("weekly")),
            Goal.Create(GoalDefinitions.WeeklyStudy("daily") with { Period = GoalPeriod.Daily, Target = 3 }),
            Goal.Create(GoalDefinitions.CourseObjective("objective")),
            Goal.Create(GoalDefinitions.WeeklyStudy("other-category", "reading")));
    }

    private GoalCredits Credits => new(_goals, _goals);

    private Task CompleteBlock(string blockId, DateOnly day, BlockOutcomeKind kind = BlockOutcomeKind.Done) =>
        new RecordBlockOutcome(_outcomes, _routines, Credits)
            .ExecuteAsync(new("weekdays", blockId, day, kind, "14:00"), CancellationToken.None);

    private Task CompleteBlock(string blockId, BlockOutcomeKind kind = BlockOutcomeKind.Done) =>
        CompleteBlock(blockId, Today, kind);

    private async Task<Dictionary<string, int>> DoneByGoal(DateOnly day) =>
        (await _goals.ListAsync(day, CancellationToken.None)).ToDictionary(goal => goal.Id, goal => goal.Done);

    private Task<Dictionary<string, int>> DoneByGoal() => DoneByGoal(Today);

    [Fact]
    public async Task CompletingABlock_CountsForTheFrequencyGoalsOfItsCategoryOnly()
    {
        await CompleteBlock("csharp");

        (await DoneByGoal()).ShouldBe(new Dictionary<string, int>
        {
            ["weekly"] = 1,
            ["daily"] = 1,
            ["objective"] = 0,
            ["other-category"] = 0,
        });
    }

    [Fact]
    public async Task CompletingABlockTwice_CountsOnce()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("csharp");

        (await DoneByGoal())["weekly"].ShouldBe(1);
    }

    [Fact]
    public async Task ThreeBlocksInADay_FillADailyGoalOfThree()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("linq");
        await CompleteBlock("docs");

        (await DoneByGoal())["daily"].ShouldBe(3);
    }

    [Fact]
    public async Task ADailyGoal_StartsAgainTheNextDay_AndKeepsWhatWasDoneBefore()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("linq");

        var tomorrow = await DoneByGoal(Today.AddDays(1));

        tomorrow["daily"].ShouldBe(0);
        (await DoneByGoal())["daily"].ShouldBe(2);
    }

    [Fact]
    public async Task AWeeklyGoal_AddsUpBlocksFromEveryDayOfTheWeek()
    {
        await CompleteBlock("csharp", Today);
        await CompleteBlock("csharp", Today.AddDays(1));

        (await DoneByGoal(Today.AddDays(1)))["weekly"].ShouldBe(2);
    }

    [Fact]
    public async Task CreditsKeepCountingBeyondTheTarget()
    {
        var goals = new InMemoryGoalRepository(Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 1 }));
        var credits = new GoalCredits(goals, goals);

        await credits.CreditBlockAsync("weekdays/a", "study", Today, CancellationToken.None);
        await credits.CreditBlockAsync("weekdays/b", "study", Today, CancellationToken.None);

        (await goals.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(2);
    }

    [Fact]
    public async Task SkippingACompletedBlock_TakesTheCreditBack()
    {
        await CompleteBlock("csharp");

        await CompleteBlock("csharp", BlockOutcomeKind.Skipped);

        (await DoneByGoal())["weekly"].ShouldBe(0);
    }

    [Fact]
    public async Task CompletingAgainAfterSkipping_CountsAgain()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("csharp", BlockOutcomeKind.Skipped);

        await CompleteBlock("csharp");

        (await DoneByGoal())["weekly"].ShouldBe(1);
    }

    [Fact]
    public async Task UndoingABlock_TakesTheCreditBack()
    {
        await CompleteBlock("csharp");

        await new UndoBlockOutcome(_outcomes, Credits).ExecuteAsync("weekdays", "csharp", Today, CancellationToken.None);

        (await DoneByGoal())["weekly"].ShouldBe(0);
    }

    [Fact]
    public async Task CompletingABlockWithoutACategory_CreditsNothing()
    {
        await CompleteBlock("work");

        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task CheckingATaskOff_DoesNotFeedGoals()
    {
        var tasks = new InMemoryTaskRepository(TaskItem.Create("t1", "Read", "study", TaskRepeat.Daily, [], null));

        await new TaskCompletions(tasks).SetAsync("t1", Today, isDone: true, CancellationToken.None);

        _goals.Events.ShouldBeEmpty();
    }
}
