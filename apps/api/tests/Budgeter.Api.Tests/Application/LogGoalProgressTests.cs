using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class LogGoalProgressTests
{
    private readonly InMemoryGoalRepository _goals = new(Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 3));

    private Task<Goal> Log(string eventId, int amount = 1, DateOnly? day = null) =>
        new LogGoalProgress(_goals, _goals).ExecuteAsync(
            new("g1", eventId, day ?? TestDays.Today, amount), CancellationToken.None);

    [Fact]
    public async Task ExecuteAsync_AddsOneRepetition()
    {
        var goal = await Log("e1");

        goal.Done.ShouldBe(4);
    }

    [Fact]
    public async Task ExecuteAsync_CountsARepeatedRequestOnce()
    {
        await Log("e1");

        var goal = await Log("e1");

        goal.Done.ShouldBe(4);
    }

    [Fact]
    public async Task ExecuteAsync_TakesBackAManualRepetition()
    {
        await Log("e1");

        var goal = await Log("e2", amount: -1);

        goal.Done.ShouldBe(3);
    }

    [Fact]
    public async Task ExecuteAsync_IgnoresATakeBackWithNothingManualLeft()
    {
        var empty = new InMemoryGoalRepository(Goal.Create(GoalDefinitions.WeeklyStudy()));

        var goal = await new LogGoalProgress(empty, empty)
            .ExecuteAsync(new("g1", "e1", TestDays.Today, -1), CancellationToken.None);

        goal.Done.ShouldBe(0);
        empty.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_CannotTakeBackLastWeeksRepetitionsThisWeek()
    {
        var lastWeek = TestDays.MondayOfThisWeek.AddDays(-1);
        var fresh = new InMemoryGoalRepository(Goal.Create(GoalDefinitions.WeeklyStudy()));
        var log = new LogGoalProgress(fresh, fresh);
        await log.ExecuteAsync(new("g1", "e1", lastWeek, 1), CancellationToken.None);

        var goal = await log.ExecuteAsync(new("g1", "e2", TestDays.Today, -1), CancellationToken.None);

        goal.Done.ShouldBe(0);
        fresh.Events.Count.ShouldBe(1);
    }

    [Fact]
    public async Task ExecuteAsync_StartsFromZeroInTheNextPeriod()
    {
        var nextMonday = TestDays.MondayOfThisWeek.AddDays(7);

        var goal = await Log("e1", day: nextMonday);

        goal.Done.ShouldBe(1);
    }

    [Fact]
    public async Task ExecuteAsync_IgnoresARepetitionPastTheTarget_SoTakingOneBackIsAlwaysVisible()
    {
        await Log("e1");
        await Log("e2");
        var atTarget = await Log("e3");

        var goal = await Log("e4", amount: -1);

        (atTarget.Done, goal.Done).ShouldBe((5, 4));
        _goals.Events.Count.ShouldBe(4);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsUnknownGoal()
    {
        var logGoalProgress = new LogGoalProgress(new InMemoryGoalRepository(), _goals);

        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            logGoalProgress.ExecuteAsync(new("missing", "e1", TestDays.Today, 1), CancellationToken.None));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100_001)]
    public async Task ExecuteAsync_RejectsAnAmountOutOfRange(int amount)
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() => Log("e1", amount));

        exception.Message.ShouldContain(amount.ToString());
    }
}
