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

    [Fact]
    public void LogProgress_AddsOneRepetition()
    {
        var goal = Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 3);

        goal.LogProgress();

        goal.Done.ShouldBe(4);
    }

    [Fact]
    public void LogProgress_StopsAtTarget()
    {
        var goal = Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 5);

        goal.LogProgress();

        goal.Done.ShouldBe(5);
    }

    [Fact]
    public void Restore_ClampsStoredProgressToTarget()
    {
        var goal = Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 9);

        goal.Done.ShouldBe(5);
    }
}
