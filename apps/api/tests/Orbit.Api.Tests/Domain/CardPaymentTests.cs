using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class CardPaymentTests
{
    private static readonly Account Checking = Account.CreateBankAccount("checking-account", "Checking account");
    private static readonly Account Visa = Account.CreateCreditCard("visa", "Visa", CardTerms.Create(500000, 3, 10));
    private static readonly DateOnly PaidOn = new(2026, 11, 10);

    [Fact]
    public void Create_GoesFromABankAccountToACard()
    {
        var payment = CardPayment.Create("p1", Visa, Checking, PaidOn, 234690);

        (payment.CardId, payment.FromAccountId, payment.AmountCents).ShouldBe(("visa", "checking-account", 234690L));
    }

    [Fact]
    public void Create_RejectsPayingABankAccount()
    {
        var exception = Should.Throw<DomainRuleException>(() => CardPayment.Create("p1", Checking, Checking, PaidOn, 100));

        exception.Message.ShouldContain("\"checking-account\"");
    }

    [Fact]
    public void Create_RejectsPayingFromACard()
    {
        Should.Throw<DomainRuleException>(() => CardPayment.Create("p1", Visa, Visa, PaidOn, 100));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    [InlineData(MoneyTransaction.MaxAbsoluteAmountCents + 1)]
    public void Create_RejectsAnAmountOutOfRange(long amountCents)
    {
        Should.Throw<DomainRuleException>(() => CardPayment.Create("p1", Visa, Checking, PaidOn, amountCents));
    }
}
