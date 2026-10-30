using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Goals;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class GoalTests
{
    [Fact]
    public void Create_StartsWithoutProgress()
    {
        var goal = Goal.Create(GoalDefinitions.WeeklyStudy());

        goal.Done.ShouldBe(0);
    }

    [Fact]
    public void Create_TrimsTitleAndUnit()
    {
        var definition = GoalDefinitions.CourseObjective() with { Title = " Course ", Unit = " modules " };

        var goal = Goal.Create(definition);

        goal.Definition.Title.ShouldBe("Course");
        goal.Definition.Unit.ShouldBe("modules");
    }

    [Fact]
    public void Create_DropsBlankUnit()
    {
        var goal = Goal.Create(GoalDefinitions.CourseObjective() with { Unit = "  " });

        goal.Definition.Unit.ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100_001)]
    public void Create_RejectsTargetOutOfRange(int target)
    {
        var definition = GoalDefinitions.WeeklyStudy() with { Target = target };

        var exception = Should.Throw<DomainRuleException>(() => Goal.Create(definition));

        exception.Message.ShouldContain(target.ToString());
    }

    [Fact]
    public void Create_RejectsUnitOnFrequencyGoal()
    {
        var definition = GoalDefinitions.WeeklyStudy() with { Unit = "books" };

        Should.Throw<DomainRuleException>(() => Goal.Create(definition)).Message.ShouldContain("\"books\"");
    }

    [Fact]
    public void Create_RequiresDeadlineForCustomPeriod()
    {
        var definition = GoalDefinitions.CourseObjective() with { Deadline = null };

        Should.Throw<DomainRuleException>(() => Goal.Create(definition)).Message.ShouldContain("deadline");
    }

    [Fact]
    public void Create_RejectsDeadlineOnRecurringPeriod()
    {
        var definition = GoalDefinitions.WeeklyStudy() with { Deadline = new DateOnly(2026, 12, 1) };

        Should.Throw<DomainRuleException>(() => Goal.Create(definition)).Message.ShouldContain("2026-12-01");
    }

    [Fact]
    public void Create_RejectsBlankTitle()
    {
        var definition = GoalDefinitions.WeeklyStudy() with { Title = " " };

        Should.Throw<DomainRuleException>(() => Goal.Create(definition));
    }

    [Theory]
    [InlineData(GoalTracking.Manual)]
    [InlineData(GoalTracking.Tasks)]
    public void Create_FeedsAFrequencyGoalFromBlocksWhateverTrackingIsSent(GoalTracking sent)
    {
        var goal = Goal.Create(GoalDefinitions.WeeklyStudy() with { Tracking = sent });

        goal.Definition.Tracking.ShouldBe(GoalTracking.Blocks);
    }

    [Fact]
    public void Create_MarksAnObjectiveByHand()
    {
        var goal = Goal.Create(GoalDefinitions.CourseObjective() with { Tracking = GoalTracking.Blocks });

        goal.Definition.Tracking.ShouldBe(GoalTracking.Manual);
    }

    [Theory]
    [InlineData("study", true)]
    [InlineData("reading", false)]
    public void AcceptsBlockOf_OnlyItsOwnCategory(string categoryId, bool expected)
    {
        Goal.Create(GoalDefinitions.WeeklyStudy()).AcceptsBlockOf(categoryId).ShouldBe(expected);
    }

    [Fact]
    public void AcceptsBlockOf_NeverForAnObjective()
    {
        Goal.Create(GoalDefinitions.CourseObjective()).AcceptsBlockOf("study").ShouldBeFalse();
    }

    [Theory]
    [InlineData(3, 0, 3)]
    [InlineData(-2, 1, 1)]
    [InlineData(4, 3, 7)]
    public void Progress_FloorsManualEntriesAtZeroAndNeverCapsTheTotal(int manual, int automatic, int expected)
    {
        GoalProgress.Compute(manual, automatic).ShouldBe(expected);
    }

    [Fact]
    public void Restore_KeepsProgressBeyondTheTarget()
    {
        var goal = Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 9);

        goal.Done.ShouldBe(9);
    }

    [Fact]
    public void RestoreObjective_ShowsTheTargetDoneOnceAchieved()
    {
        var goal = Goal.RestoreObjective(GoalDefinitions.CourseObjective(), TestDays.Today);

        (goal.Done, goal.AchievedOn).ShouldBe((12, TestDays.Today));
    }

    [Fact]
    public void RestoreObjective_ShowsNothingDoneWhilePending()
    {
        var goal = Goal.RestoreObjective(GoalDefinitions.CourseObjective(), achievedOn: null);

        (goal.Done, goal.AchievedOn).ShouldBe((0, (DateOnly?)null));
    }
}
