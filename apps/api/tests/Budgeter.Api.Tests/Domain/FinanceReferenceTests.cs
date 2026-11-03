using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class FinanceReferenceTests
{
    [Fact]
    public void Account_TrimsTheName()
    {
        Account.Create("nubank", "  Nubank ", AccountKind.BankAccount).Name.ShouldBe("Nubank");
    }

    [Fact]
    public void Account_RejectsANameOverTheLimit()
    {
        Should.Throw<DomainRuleException>(() =>
            Account.Create("nubank", new string('a', Account.MaxNameLength + 1), AccountKind.BankAccount));
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
