using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class BillTests
{
    private static readonly DateOnly November5 = new(2026, 11, 5);

    private static Bill Rent(BillKind kind = BillKind.Payable, long amountCents = 150000) =>
        Bill.Create("b1", kind, "  Rent ", "housing", amountCents, November5);

    [Fact]
    public void Create_TrimsTheDescriptionAndStartsOpen()
    {
        var bill = Rent();

        (bill.Description, bill.IsSettled).ShouldBe(("Rent", false));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1_000_000_001)]
    public void Create_RejectsAnAmountOutsideOneToTheLimit(long amountCents)
    {
        var exception = Should.Throw<DomainRuleException>(() => Rent(amountCents: amountCents));

        exception.Message.ShouldContain(amountCents.ToString());
    }

    [Fact]
    public void Create_RejectsABlankDescription()
    {
        Should.Throw<DomainRuleException>(() =>
            Bill.Create("b1", BillKind.Payable, "  ", "housing", 100, November5));
    }

    [Fact]
    public void SignedAmount_IsNegativeForAPayableAndPositiveForAReceivable()
    {
        (Rent().SignedAmountCents, Rent(BillKind.Receivable).SignedAmountCents).ShouldBe((-150000L, 150000L));
    }

    [Fact]
    public void Settle_RecordsTheDayAndAccountAndRepeatingItChangesNothing()
    {
        var settled = Rent().Settle(November5, "checking-account");

        settled.Settle(November5, "checking-account").ShouldBeSameAs(settled);
        settled.Settlement.ShouldBe(new BillSettlement(November5, "checking-account"));
    }

    [Fact]
    public void Settle_RejectsSettlingAgainOtherwise()
    {
        var settled = Rent().Settle(November5, "checking-account");

        var exception = Should.Throw<DomainRuleException>(() => settled.Settle(November5.AddDays(1), "checking-account"));

        exception.Message.ShouldContain("2026-11-05");
    }

    [Fact]
    public void Reopen_ClearsTheSettlement()
    {
        var reopened = Rent().Settle(November5, "checking-account").Reopen();

        reopened.IsSettled.ShouldBeFalse();
    }
}
