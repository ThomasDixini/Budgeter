using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class SinkingFundTests
{
    private static readonly DateOnly NextJanuary15 = new(2027, 1, 15);

    private static SinkingFund Ipva(
        long amountCents = 120000, string id = "f1", string description = "  IPVA ") =>
        SinkingFund.Create(id, description, "taxes", amountCents, SinkingFundSchedule.FixedDate(1, 15), NextJanuary15);

    [Fact]
    public void Create_TrimsTheDescription()
    {
        Ipva().Description.ShouldBe("IPVA");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_RejectsABlankDescription(string description)
    {
        Should.Throw<DomainRuleException>(() => Ipva(description: description));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1_000_000_001)]
    public void Create_RejectsAnAmountOutsideOneToTheLimit(long amountCents)
    {
        var exception = Should.Throw<DomainRuleException>(() => Ipva(amountCents: amountCents));

        exception.Message.ShouldContain(amountCents.ToString());
    }

    [Fact]
    public void Create_RejectsAnIdLongerThanFortyEightCharacters()
    {
        var id = new string('a', 49);

        var exception = Should.Throw<DomainRuleException>(() => Ipva(id: id));

        exception.Message.ShouldContain("1-48");
    }

    [Fact]
    public void Create_AcceptsAnIdOfFortyEightCharacters()
    {
        Ipva(id: new string('a', 48)).CurrentBillId.Length.ShouldBeLessThanOrEqualTo(64);
    }

    [Fact]
    public void Create_RejectsAnIdWithInvalidCharacters()
    {
        Should.Throw<DomainRuleException>(() => Ipva(id: "f 1"));
    }

    [Fact]
    public void CycleStart_IsTheDueDateOneCycleBack()
    {
        Ipva().CycleStart.ShouldBe(new DateOnly(2026, 1, 15));
    }

    [Fact]
    public void SavedCents_IsZeroOnTheCycleStart()
    {
        Ipva().SavedCents(new DateOnly(2026, 1, 15)).ShouldBe(0);
    }

    [Fact]
    public void SavedCents_IsZeroBeforeTheCycleStart()
    {
        Ipva().SavedCents(new DateOnly(2025, 12, 1)).ShouldBe(0);
    }

    [Fact]
    public void SavedCents_IsProportionalToTheWholeMonthsElapsed()
    {
        Ipva().SavedCents(new DateOnly(2026, 7, 15)).ShouldBe(60000);
    }

    [Fact]
    public void SavedCents_DoesNotCountAMonthBeforeItsDayArrives()
    {
        Ipva().SavedCents(new DateOnly(2026, 7, 14)).ShouldBe(50000);
    }

    [Fact]
    public void SavedCents_IsTheFullAmountOnTheDueDate()
    {
        Ipva().SavedCents(NextJanuary15).ShouldBe(120000);
    }

    [Fact]
    public void SavedCents_IsTheFullAmountAfterTheDueDate()
    {
        Ipva().SavedCents(new DateOnly(2027, 6, 1)).ShouldBe(120000);
    }

    [Fact]
    public void MonthlyCents_RoundsUp()
    {
        Ipva(amountCents: 10001).MonthlyCents.ShouldBe(834);
    }

    [Fact]
    public void CurrentBillId_CarriesTheFundIdAndTheDueDate()
    {
        Ipva().CurrentBillId.ShouldBe("sf-f1-20270115");
    }

    [Fact]
    public void CurrentBill_IsAnOpenPayableForTheDueDate()
    {
        var bill = Ipva().CurrentBill();

        (bill.Id, bill.Kind, bill.Description, bill.CategoryId, bill.AmountCents, bill.DueDate, bill.IsSettled)
            .ShouldBe(("sf-f1-20270115", BillKind.Payable, "IPVA", "taxes", 120000L, NextJanuary15, false));
    }

    [Fact]
    public void AdvancedOneCycle_MovesTheDueDateAndKeepsTheRest()
    {
        var advanced = Ipva().AdvancedOneCycle();

        (advanced.NextDueDate, advanced.Id, advanced.AmountCents, advanced.CycleStart)
            .ShouldBe((new DateOnly(2028, 1, 15), "f1", 120000L, NextJanuary15));
    }
}
