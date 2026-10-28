using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Domain.Tasks;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

/// <summary>Completing blocks and tasks feeds the goals that are tracked from them.</summary>
public class GoalCreditsTests
{
    private static readonly DateOnly Today = TestDays.Today;
    private readonly InMemoryGoalRepository _goals;
    private readonly InMemoryBlockOutcomeRepository _outcomes = new();
    private readonly InMemoryRoutineRepository _routines = new(Routines.Weekdays());
    private readonly InMemoryTaskRepository _tasks = new(
        TaskItem.Create("t1", "Read", "study", TaskRepeat.Daily, [], null),
        TaskItem.Create("t2", "Water plants", null, TaskRepeat.Daily, [], null));

    public GoalCreditsTests()
    {
        _goals = new InMemoryGoalRepository(
            Goal.Create(GoalDefinitions.WeeklyStudy("from-blocks") with { Tracking = GoalTracking.Blocks }),
            Goal.Create(GoalDefinitions.WeeklyStudy("from-tasks") with { Tracking = GoalTracking.Tasks }),
            Goal.Create(GoalDefinitions.WeeklyStudy("by-hand")),
            Goal.Create(GoalDefinitions.WeeklyStudy("other-category", "reading") with { Tracking = GoalTracking.Blocks }));
    }

    private GoalCredits Credits => new(_goals, _goals);

    private Task CompleteBlock(string blockId, BlockOutcomeKind kind = BlockOutcomeKind.Done) =>
        new RecordBlockOutcome(_outcomes, _routines, Credits)
            .ExecuteAsync(new("weekdays", blockId, Today, kind, "14:00"), CancellationToken.None);

    private async Task<Dictionary<string, int>> DoneByGoal() =>
        (await _goals.ListAsync(Today, CancellationToken.None)).ToDictionary(goal => goal.Id, goal => goal.Done);

    [Fact]
    public async Task CompletingABlock_CountsOnlyForGoalsTrackedFromBlocksInItsCategory()
    {
        await CompleteBlock("csharp");

        (await DoneByGoal()).ShouldBe(new Dictionary<string, int>
        {
            ["from-blocks"] = 1,
            ["from-tasks"] = 0,
            ["by-hand"] = 0,
            ["other-category"] = 0,
        });
    }

    [Fact]
    public async Task CompletingABlockTwice_CountsOnce()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("csharp");

        (await DoneByGoal())["from-blocks"].ShouldBe(1);
    }

    [Fact]
    public async Task SkippingACompletedBlock_TakesTheCreditBack()
    {
        await CompleteBlock("csharp");

        await CompleteBlock("csharp", BlockOutcomeKind.Skipped);

        (await DoneByGoal())["from-blocks"].ShouldBe(0);
    }

    [Fact]
    public async Task CompletingAgainAfterSkipping_CountsAgain()
    {
        await CompleteBlock("csharp");
        await CompleteBlock("csharp", BlockOutcomeKind.Skipped);

        await CompleteBlock("csharp");

        (await DoneByGoal())["from-blocks"].ShouldBe(1);
    }

    [Fact]
    public async Task UndoingABlock_TakesTheCreditBack()
    {
        await CompleteBlock("csharp");

        await new UndoBlockOutcome(_outcomes, Credits).ExecuteAsync("weekdays", "csharp", Today, CancellationToken.None);

        (await DoneByGoal())["from-blocks"].ShouldBe(0);
    }

    [Fact]
    public async Task CompletingABlockWithoutACategory_CreditsNothing()
    {
        await CompleteBlock("work");

        (await DoneByGoal()).Values.ShouldAllBe(done => done == 0);
        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task CheckingATaskOff_CountsOnlyForGoalsTrackedFromTasks()
    {
        await new TaskCompletions(_tasks, Credits).SetAsync("t1", Today, isDone: true, CancellationToken.None);

        var done = await DoneByGoal();
        (done["from-tasks"], done["from-blocks"], done["by-hand"]).ShouldBe((1, 0, 0));
    }

    [Fact]
    public async Task UncheckingATask_TakesTheCreditBack()
    {
        var completions = new TaskCompletions(_tasks, Credits);
        await completions.SetAsync("t1", Today, isDone: true, CancellationToken.None);

        await completions.SetAsync("t1", Today, isDone: false, CancellationToken.None);

        (await DoneByGoal())["from-tasks"].ShouldBe(0);
    }

    [Fact]
    public async Task CheckingOffATaskWithoutACategory_CreditsNothing()
    {
        await new TaskCompletions(_tasks, Credits).SetAsync("t2", Today, isDone: true, CancellationToken.None);

        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task CreditsKeepCountingBeyondTheTarget_SoTakingOneBackNeverLosesAnother()
    {
        var capped = new InMemoryGoalRepository(
            Goal.Create(GoalDefinitions.WeeklyStudy() with { Target = 1, Tracking = GoalTracking.Blocks }));
        var credits = new GoalCredits(capped, capped);
        await credits.CreditAsync(GoalSource.Block, "weekdays/a", "study", Today, CancellationToken.None);
        await credits.CreditAsync(GoalSource.Block, "weekdays/b", "study", Today, CancellationToken.None);

        await credits.RevokeAsync(GoalSource.Block, "weekdays/a", Today, CancellationToken.None);

        (await capped.FindAsync("g1", Today, CancellationToken.None))!.Done.ShouldBe(1);
    }
}
