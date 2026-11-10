using Orbit.Api.Application;
using Orbit.Api.Application.Goals;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class SetGoalAchievementTests
{
    private readonly InMemoryGoalRepository _goals = new(
        Goal.Create(GoalDefinitions.CourseObjective()),
        Goal.Create(GoalDefinitions.WeeklyStudy()),
        Goal.Create(GoalDefinitions.WeeklyObjective()));

    private static readonly DateOnly NextWeek = TestDays.Today.AddDays(7);

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

    // Regression: the mark had no period, so a weekly objective stayed achieved forever and could
    // never be marked again.
    [Fact]
    public async Task ExecuteAsync_LeavesAWeeklyObjectivePendingInTheNextWeek()
    {
        await Set("g5", isAchieved: true);

        var nextWeek = await _goals.FindAsync("g5", NextWeek, CancellationToken.None);

        nextWeek!.AchievedOn.ShouldBeNull();
    }

    [Fact]
    public async Task ExecuteAsync_MarksAWeeklyObjectiveAgainInTheNextWeek()
    {
        await Set("g5", isAchieved: true);

        var goal = await Set("g5", isAchieved: true, NextWeek);

        goal.AchievedOn.ShouldBe(NextWeek);
    }

    [Fact]
    public async Task ExecuteAsync_TakesBackOnlyTheMarkOfTheWeekOfTheDay()
    {
        await Set("g5", isAchieved: true);
        await Set("g5", isAchieved: true, NextWeek);

        await Set("g5", isAchieved: false, NextWeek);

        (await _goals.FindAsync("g5", TestDays.Today, CancellationToken.None))!.AchievedOn.ShouldBe(TestDays.Today);
    }
}
