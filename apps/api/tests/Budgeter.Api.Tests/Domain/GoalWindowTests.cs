using Budgeter.Api.Domain.Goals;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class GoalWindowTests
{
    // 2026-10-28 is a Wednesday.
    private static readonly DateOnly Wednesday = new(2026, 10, 28);

    [Fact]
    public void Daily_IsJustThatDay()
    {
        GoalWindow.For(GoalPeriod.Daily, Wednesday, null).ShouldBe(new GoalWindow(Wednesday, Wednesday));
    }

    [Theory]
    [InlineData(2026, 10, 26)] // Monday
    [InlineData(2026, 10, 28)] // Wednesday
    [InlineData(2026, 11, 1)] // Sunday
    public void Weekly_RunsMondayToSundayAroundAnyDayOfTheWeek(int year, int month, int day)
    {
        var window = GoalWindow.For(GoalPeriod.Weekly, new DateOnly(year, month, day), null);

        window.ShouldBe(new GoalWindow(new DateOnly(2026, 10, 26), new DateOnly(2026, 11, 1)));
    }

    [Fact]
    public void Weekly_CanCrossTheNewYear()
    {
        var window = GoalWindow.For(GoalPeriod.Weekly, new DateOnly(2026, 12, 31), null);

        window.ShouldBe(new GoalWindow(new DateOnly(2026, 12, 28), new DateOnly(2027, 1, 3)));
    }

    [Theory]
    [InlineData(2026, 2, 28)]
    [InlineData(2028, 2, 29)]
    public void Monthly_EndsOnTheLastDayEvenInFebruary(int year, int month, int lastDay)
    {
        var window = GoalWindow.For(GoalPeriod.Monthly, new DateOnly(year, month, 10), null);

        window.ShouldBe(new GoalWindow(new DateOnly(year, month, 1), new DateOnly(year, month, lastDay)));
    }

    [Fact]
    public void Yearly_IsTheCalendarYear()
    {
        GoalWindow.For(GoalPeriod.Yearly, Wednesday, null)
            .ShouldBe(new GoalWindow(new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31)));
    }

    [Fact]
    public void Custom_HasNoStartAndEndsOnTheDeadline()
    {
        var window = GoalWindow.For(GoalPeriod.Custom, Wednesday, new DateOnly(2026, 12, 15));

        (window.Contains(new DateOnly(2020, 1, 1)), window.Contains(new DateOnly(2026, 12, 15)),
            window.Contains(new DateOnly(2026, 12, 16))).ShouldBe((true, true, false));
    }
}
