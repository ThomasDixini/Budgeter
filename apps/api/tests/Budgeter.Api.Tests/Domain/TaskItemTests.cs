using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Tasks;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class TaskItemTests
{
    private static readonly DateOnly Today = new(2026, 10, 27);

    [Fact]
    public void Create_KeepsADateOnlyForAOneOffTask()
    {
        var task = TaskItem.Create("t1", "Call the bank", null, TaskRepeat.Once, [1, 2], Today);

        (task.Date, task.Days.Count).ShouldBe((Today, 0));
    }

    [Fact]
    public void Create_RequiresADateForAOneOffTask()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            TaskItem.Create("t1", "Call the bank", null, TaskRepeat.Once, [], null));

        exception.Message.ShouldContain("YYYY-MM-DD");
    }

    [Fact]
    public void Create_DropsDaysAndDateFromADailyTask()
    {
        var task = TaskItem.Create("t1", "Read", null, TaskRepeat.Daily, [3], Today);

        (task.Date, task.Days.Count).ShouldBe((null, 0));
    }

    [Fact]
    public void Create_SortsTheWeekdaysOfAWeeklyTask()
    {
        var task = TaskItem.Create("t1", "Gym", null, TaskRepeat.Weekly, [4, 0, 4, 2], null);

        task.Days.ShouldBe([0, 2, 4]);
    }

    [Theory]
    [InlineData(new int[0], "[]")]
    [InlineData(new[] { 0, 7 }, "[0, 7]")]
    public void Create_RejectsAWeeklyTaskWithoutValidDays(int[] days, string shown)
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            TaskItem.Create("t1", "Gym", null, TaskRepeat.Weekly, days, null));

        exception.Message.ShouldContain(shown);
    }

    [Fact]
    public void Create_TrimsTheTitleAndRejectsABlankOne()
    {
        TaskItem.Create("t1", "  Read ", null, TaskRepeat.Daily, [], null).Title.ShouldBe("Read");
        Should.Throw<DomainRuleException>(() => TaskItem.Create("t1", "  ", null, TaskRepeat.Daily, [], null));
    }
}
