using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class SetGoalAchievementTests
{
    private readonly InMemoryGoalRepository _goals = new(
        Goal.Create(GoalDefinitions.CourseObjective()),
        Goal.Create(GoalDefinitions.WeeklyStudy()));

    private Task<Goal> Set(string goalId, bool isAchieved, DateOnly? day = null) =>
        new SetGoalAchievement(_goals, _goals).ExecuteAsync(
            new(goalId, day ?? TestDays.Today, isAchieved), CancellationToken.None);

    [Fact]
    public async Task ExecuteAsync_MarksAnObjectiveAchievedOnTheDay()
    {
        var goal = await Set("g2", isAchieved: true);

        (goal.AchievedOn, goal.Done).ShouldBe((TestDays.Today, 12));
    }

    [Fact]
    public async Task ExecuteAsync_KeepsTheFirstDayWhenMarkedAgain()
    {
        await Set("g2", isAchieved: true);

        var goal = await Set("g2", isAchieved: true, TestDays.Today.AddDays(2));

        goal.AchievedOn.ShouldBe(TestDays.Today);
    }

    [Fact]
    public async Task ExecuteAsync_TakesTheMarkBack()
    {
        await Set("g2", isAchieved: true);

        var goal = await Set("g2", isAchieved: false);

        (goal.AchievedOn, goal.Done).ShouldBe(((DateOnly?)null, 0));
        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_ShowsTheObjectivePendingOnDaysBeforeItWasAchieved()
    {
        await Set("g2", isAchieved: true);

        var yesterday = await _goals.FindAsync("g2", TestDays.Today.AddDays(-1), CancellationToken.None);

        yesterday!.AchievedOn.ShouldBeNull();
    }

    [Fact]
    public async Task ExecuteAsync_RejectsAFrequencyGoal()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() => Set("g1", isAchieved: true));

        exception.Message.ShouldContain("\"g1\"");
        _goals.Events.ShouldBeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_RejectsAnUnknownGoal()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() => Set("missing", isAchieved: true));
    }
}
