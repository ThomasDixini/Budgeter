using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class SinkingFundScheduleTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(61)]
    public void EveryMonths_RejectsAnIntervalOutsideOneToSixty(int intervalMonths)
    {
        var exception = Should.Throw<DomainRuleException>(() => SinkingFundSchedule.EveryMonths(intervalMonths, 10));

        exception.Message.ShouldContain(intervalMonths.ToString());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(32)]
    public void EveryMonths_RejectsADueDayOutsideOneToThirtyOne(int dueDay)
    {
        var exception = Should.Throw<DomainRuleException>(() => SinkingFundSchedule.EveryMonths(2, dueDay));

        exception.Message.ShouldContain(dueDay.ToString());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public void FixedDate_RejectsAMonthOutsideOneToTwelve(int month)
    {
        var exception = Should.Throw<DomainRuleException>(() => SinkingFundSchedule.FixedDate(month, 10));

        exception.Message.ShouldContain(month.ToString());
    }

    [Fact]
    public void FixedDate_RejectsADueDayAboveThirtyOne()
    {
        var exception = Should.Throw<DomainRuleException>(() => SinkingFundSchedule.FixedDate(3, 32));

        exception.Message.ShouldContain("32");
    }

    [Fact]
    public void FixedDate_UsesAYearlyCycleOnTheGivenMonth()
    {
        var schedule = SinkingFundSchedule.FixedDate(3, 10);

        (schedule.Kind, schedule.IntervalMonths, schedule.Month, schedule.DueDay)
            .ShouldBe((SinkingFundScheduleKind.FixedDate, 12, (int?)3, 10));
    }

    [Fact]
    public void Following_ReturnsToTheThirtyFirstAfterAShorterMonth()
    {
        var schedule = SinkingFundSchedule.EveryMonths(1, 31);

        var february = schedule.Following(new DateOnly(2026, 1, 31));
        var march = schedule.Following(february);

        (february, march).ShouldBe((new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31)));
    }

    [Fact]
    public void Preceding_ReturnsToTheThirtyFirstBeforeAShorterMonth()
    {
        var schedule = SinkingFundSchedule.EveryMonths(1, 31);

        var february = schedule.Preceding(new DateOnly(2026, 3, 31));
        var january = schedule.Preceding(february);

        (february, january).ShouldBe((new DateOnly(2026, 2, 28), new DateOnly(2026, 1, 31)));
    }

    [Fact]
    public void Following_MovesAFixedDateOneYear()
    {
        var schedule = SinkingFundSchedule.FixedDate(1, 15);

        schedule.Following(new DateOnly(2027, 1, 15)).ShouldBe(new DateOnly(2028, 1, 15));
    }

    [Fact]
    public void FirstDueOnOrAfter_ReturnsThisYearWhenTheDateIsStillAhead()
    {
        var schedule = SinkingFundSchedule.FixedDate(6, 10);

        schedule.FirstDueOnOrAfter(new DateOnly(2026, 3, 1)).ShouldBe(new DateOnly(2026, 6, 10));
    }

    [Fact]
    public void FirstDueOnOrAfter_ReturnsTheSameDayWhenItIsTheDueDate()
    {
        var schedule = SinkingFundSchedule.FixedDate(6, 10);

        schedule.FirstDueOnOrAfter(new DateOnly(2026, 6, 10)).ShouldBe(new DateOnly(2026, 6, 10));
    }

    [Fact]
    public void FirstDueOnOrAfter_ReturnsNextYearWhenTheDateHasPassed()
    {
        var schedule = SinkingFundSchedule.FixedDate(6, 10);

        schedule.FirstDueOnOrAfter(new DateOnly(2026, 6, 11)).ShouldBe(new DateOnly(2027, 6, 10));
    }

    [Fact]
    public void FirstDueOnOrAfter_UsesTheTwentyEighthOfFebruaryForALeapDayInANonLeapYear()
    {
        var schedule = SinkingFundSchedule.FixedDate(2, 29);

        schedule.FirstDueOnOrAfter(new DateOnly(2027, 1, 1)).ShouldBe(new DateOnly(2027, 2, 28));
    }

    [Fact]
    public void FirstDueOnOrAfter_RejectsAnEveryMonthsSchedule()
    {
        var schedule = SinkingFundSchedule.EveryMonths(2, 10);

        Should.Throw<InvalidOperationException>(() => schedule.FirstDueOnOrAfter(new DateOnly(2026, 1, 1)))
            .Message.ShouldContain("EveryMonths");
    }
}
