using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Routines;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class RoutineTests
{
    private static readonly RoutineBlock Work = RoutineBlock.Create("work", "Work", "08:00", "12:00", null);

    [Fact]
    public void Create_SortsAndDeduplicatesDays()
    {
        var routine = Routine.Create("r1", "Mixed", [4, 0, 4, 2], "08:00", "17:00", []);

        routine.Days.ShouldBe([0, 2, 4]);
    }

    [Fact]
    public void Create_AcceptsNoDays()
    {
        Routine.Create("r1", "Someday", [], "08:00", "17:00", []).Days.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(7)]
    public void Create_RejectsDayOutsideTheWeek(int day)
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Routine.Create("r1", "Weekdays", [0, day], "08:00", "17:00", []));

        exception.Message.ShouldContain($"[{day}]");
    }

    [Theory]
    [InlineData("00:00", "00:00")]
    [InlineData("22:00", "06:00")]
    public void Create_AcceptsFullAndOvernightDays(string start, string end)
    {
        var routine = Routine.Create("r1", "All day", [0], start, end, []);

        (routine.Start, routine.End).ShouldBe((start, end));
    }

    [Fact]
    public void BlockCreate_AcceptsABlockRunningPastMidnight()
    {
        RoutineBlock.Create("sleep", "Sleep", "22:00", "06:00", null).End.ShouldBe("06:00");
    }

    [Theory]
    [InlineData("8:00")]
    [InlineData("24:00")]
    [InlineData("noon")]
    public void Create_RejectsTimeNotShapedLikeClock(string start)
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Routine.Create("r1", "Weekdays", [0], start, "23:00", []));

        exception.Message.ShouldContain("HH:mm");
    }

    [Fact]
    public void Create_RejectsRepeatedBlockIds()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Routine.Create("r1", "Weekdays", [0], "08:00", "17:00", [Work, Work]));

        exception.Message.ShouldContain("\"work\"");
    }

    [Fact]
    public void Create_KeepsBlockOrderAndListsCategoriesOnce()
    {
        var first = RoutineBlock.Create("b1", "Study", "13:00", "14:00", "study");
        var second = RoutineBlock.Create("b2", "Study again", "15:00", "16:00", "study");

        var routine = Routine.Create("r1", "Weekdays", [0], "08:00", "17:00", [first, Work, second]);

        routine.Blocks.Select(block => block.Id).ShouldBe(["b1", "work", "b2"]);
        routine.CategoryIds.ShouldBe(["study"]);
    }

    [Fact]
    public void BlockCreate_TrimsNameAndAllowsNoCategory()
    {
        var block = RoutineBlock.Create("lunch", "  Lunch ", "12:00", "13:00", null);

        block.Name.ShouldBe("Lunch");
        block.CategoryId.ShouldBeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("has spaces")]
    public void BlockCreate_RejectsMalformedCategoryId(string categoryId)
    {
        Should.Throw<DomainRuleException>(() => RoutineBlock.Create("b1", "Study", "08:00", "09:00", categoryId));
    }
}
