using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class MoneyTransactionTests
{
    private static readonly DateOnly Day = new(2026, 10, 31);

    private static MoneyTransaction Groceries(long amountCents = -28640, string description = "Groceries") =>
        MoneyTransaction.Create("tx1", Day, description, "food", "credit-card", amountCents);

    [Fact]
    public void Create_TrimsTheDescription()
    {
        Groceries(description: "  Groceries ").Description.ShouldBe("Groceries");
    }

    [Theory]
    [InlineData(950000, true)]
    [InlineData(-28640, false)]
    public void Create_TellsIncomeFromExpenseByTheSign(long amountCents, bool isIncome)
    {
        Groceries(amountCents).IsIncome.ShouldBe(isIncome);
    }

    [Fact]
    public void Create_RejectsAZeroAmount()
    {
        var exception = Should.Throw<DomainRuleException>(() => Groceries(0));

        exception.Message.ShouldContain("received 0");
    }

    [Theory]
    [InlineData(1_000_000_001)]
    [InlineData(-1_000_000_001)]
    public void Create_RejectsAnAmountPastTheLimit(long amountCents)
    {
        Should.Throw<DomainRuleException>(() => Groceries(amountCents));
    }

    [Fact]
    public void Create_AcceptsAnAmountAtTheLimit()
    {
        Groceries(-MoneyTransaction.MaxAbsoluteAmountCents).AmountCents.ShouldBe(-1_000_000_000);
    }

    [Fact]
    public void Create_RejectsABlankDescription()
    {
        Should.Throw<DomainRuleException>(() => Groceries(description: "   "));
    }

    [Fact]
    public void Create_RejectsAMalformedAccountId()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            MoneyTransaction.Create("tx1", Day, "Groceries", "food", "credit card", -100));

        exception.Message.ShouldContain("\"credit card\"");
    }
}
