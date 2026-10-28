using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class UpdateAndDeleteGoalTests
{
    private readonly InMemoryGoalRepository _goals = new(Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 3));

    private Task<Goal> Update(Func<UpdateGoalCommand, UpdateGoalCommand>? change = null)
    {
        var command = new UpdateGoalCommand(
            "g1", "Study C# 4x a week", GoalPeriod.Weekly, 4, null, null, GoalTracking.Manual, TestDays.Today);
        return new UpdateGoal(_goals, _goals).ExecuteAsync(change?.Invoke(command) ?? command, CancellationToken.None);
    }

    [Fact]
    public async Task Update_ChangesTheDefinitionAndKeepsTheProgress()
    {
        var goal = await Update();

        (goal.Definition.Title, goal.Definition.Target, goal.Done).ShouldBe(("Study C# 4x a week", 4, 3));
    }

    [Fact]
    public async Task Update_KeepsTheTypeAndCategory()
    {
        var goal = await Update();

        (goal.Definition.Type, goal.CategoryId).ShouldBe((GoalType.Frequency, "study"));
    }

    [Fact]
    public async Task Update_LoweringTheTargetBelowTheProgressShowsItCapped()
    {
        var goal = await Update(command => command with { Target = 2 });

        goal.Done.ShouldBe(2);
    }

    [Fact]
    public async Task Update_ChangingWhatFeedsTheGoalDropsTheOldAutomaticEntriesOnly()
    {
        await _goals.RecordAsync(new("auto", "g1", TestDays.Today, 1, GoalSource.Block, "weekdays/csharp"), CancellationToken.None);

        await Update(command => command with { Tracking = GoalTracking.Tasks });

        _goals.Events.Select(entry => entry.EventId).ShouldBe(["seed:g1"]);
    }

    [Fact]
    public async Task Update_KeepingTheTrackingKeepsAutomaticEntries()
    {
        await _goals.RecordAsync(new("auto", "g1", TestDays.Today, 1, GoalSource.Block, "weekdays/csharp"), CancellationToken.None);

        await Update();

        _goals.Events.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Update_RejectsABrokenRuleAndChangesNothing()
    {
        await Should.ThrowAsync<DomainRuleException>(() => Update(command => command with { Target = 0 }));

        (await _goals.FindAsync("g1", TestDays.Today, CancellationToken.None))!.Definition.Target.ShouldBe(5);
    }

    [Fact]
    public async Task Update_RejectsUnknownGoal()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => Update(command => command with { Id = "missing" }));
    }

    [Fact]
    public async Task Delete_RemovesTheGoalAndItsProgressAndIgnoresOneAlreadyGone()
    {
        var delete = new DeleteGoal(_goals);

        await delete.ExecuteAsync("g1", CancellationToken.None);
        await delete.ExecuteAsync("g1", CancellationToken.None);

        (await _goals.ListAsync(TestDays.Today, CancellationToken.None)).ShouldBeEmpty();
        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task Delete_RejectsAMalformedId()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            new DeleteGoal(_goals).ExecuteAsync("has spaces", CancellationToken.None));

        exception.Message.ShouldContain("\"has spaces\"");
    }
}
