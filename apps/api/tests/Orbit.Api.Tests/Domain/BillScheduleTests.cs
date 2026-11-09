using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class BillScheduleTests
{
    private static IReadOnlyList<Bill> Occurrences(
        BillRecurrence recurrence, int count, DateOnly? firstDue = null) =>
        BillSchedule.Occurrences(
            "b1", BillKind.Payable, "Rent", "housing", 150000, firstDue ?? new DateOnly(2026, 11, 5), recurrence, count);

    [Fact]
    public void Monthly_NumbersTheIdsAfterTheFirstAndStepsByMonths()
    {
        var bills = Occurrences(BillRecurrence.Monthly, 3);

        bills.Select(bill => bill.Id).ShouldBe(["b1", "b1-2", "b1-3"]);
        bills.Select(bill => bill.DueDate).ShouldBe([new DateOnly(2026, 11, 5), new DateOnly(2026, 12, 5), new DateOnly(2027, 1, 5)]);
    }

    [Fact]
    public void Monthly_CountsFromTheFirstDueDateSoTheLastDayOfAShortMonthDoesNotDrift()
    {
        var bills = Occurrences(BillRecurrence.Monthly, 3, new DateOnly(2027, 1, 31));

        bills.Select(bill => bill.DueDate).ShouldBe([new DateOnly(2027, 1, 31), new DateOnly(2027, 2, 28), new DateOnly(2027, 3, 31)]);
    }

    [Fact]
    public void Yearly_StepsByYears()
    {
        var bills = Occurrences(BillRecurrence.Yearly, 2);

        bills[1].DueDate.ShouldBe(new DateOnly(2027, 11, 5));
    }

    [Fact]
    public void Occurrences_RememberTheirPlaceInTheSeries()
    {
        var bills = Occurrences(BillRecurrence.Installments, 3);

        bills[2].Series.ShouldBe(new BillSeries("b1", BillRecurrence.Installments, 3, 3));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(61)]
    public void Occurrences_RejectACountOutsideTwoToSixty(int count)
    {
        var exception = Should.Throw<DomainRuleException>(() => Occurrences(BillRecurrence.Monthly, count));

        exception.Message.ShouldContain($"received {count}");
    }
}
