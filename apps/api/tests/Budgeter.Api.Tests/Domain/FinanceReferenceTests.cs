using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class FinanceReferenceTests
{
    private static readonly CardTerms Terms = CardTerms.Create(500000, closingDay: 3, dueDay: 10);

    [Fact]
    public void Account_TrimsTheName()
    {
        Account.CreateBankAccount("nubank", "  Nubank ").Name.ShouldBe("Nubank");
    }

    [Fact]
    public void Account_RejectsANameOverTheLimit()
    {
        Should.Throw<DomainRuleException>(() =>
            Account.CreateBankAccount("nubank", new string('a', Account.MaxNameLength + 1)));
    }

    [Fact]
    public void BankAccount_KeepsANegativeOpeningBalance()
    {
        Account.CreateBankAccount("nubank", "Nubank", openingBalanceCents: -15000).OpeningBalanceCents.ShouldBe(-15000);
    }

    [Fact]
    public void BankAccount_RejectsAnOpeningBalanceOverTheAmountLimit()
    {
        Should.Throw<DomainRuleException>(() =>
            Account.CreateBankAccount("nubank", "Nubank", MoneyTransaction.MaxAbsoluteAmountCents + 1));
    }

    [Fact]
    public void BankAccount_RejectsCardTerms()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Account.Create("nubank", "Nubank", AccountKind.BankAccount, 0, Terms));

        exception.Message.ShouldContain("limit 500000");
    }

    [Fact]
    public void CreditCard_RequiresCardTerms()
    {
        Should.Throw<DomainRuleException>(() =>
            Account.Create("visa", "Visa", AccountKind.CreditCard, 0, card: null));
    }

    [Fact]
    public void CreditCard_RejectsAnOpeningBalance()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            Account.Create("visa", "Visa", AccountKind.CreditCard, 1000, Terms));

        exception.Message.ShouldContain("received 1000");
    }

    [Fact]
    public void CreditCard_KeepsItsTerms()
    {
        Account.CreateCreditCard("visa", "Visa", Terms).Card.ShouldBe(Terms);
    }

    [Fact]
    public void FinanceCategory_TrimsTheName()
    {
        FinanceCategory.Create("food", " Food ").Name.ShouldBe("Food");
    }

    [Fact]
    public void FinanceCategory_RejectsAMalformedId()
    {
        Should.Throw<DomainRuleException>(() => FinanceCategory.Create("fo od", "Food"));
    }
}
