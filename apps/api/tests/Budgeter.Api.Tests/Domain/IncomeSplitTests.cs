using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class IncomeSplitTests
{
    private static IncomeSplitPart Part(string id, int percent = 50, params string[] categoryIds) =>
        IncomeSplitPart.Create(id, "Fixed costs", percent, 0, categoryIds);

    [Fact]
    public void Part_TrimsTheName()
    {
        IncomeSplitPart.Create("fixed", "  Fixed costs ", 50, 0, []).Name.ShouldBe("Fixed costs");
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(101, 0)]
    [InlineData(50, -1)]
    [InlineData(50, IncomeSplitPart.ColorCount)]
    public void Part_RejectsAPercentOrColorOutOfRange(int percent, int color)
    {
        Should.Throw<DomainRuleException>(() => IncomeSplitPart.Create("fixed", "Fixed costs", percent, color, []));
    }

    [Fact]
    public void Part_RejectsAMalformedCategoryId()
    {
        Should.Throw<DomainRuleException>(() => Part("fixed", 50, "ho using"));
    }

    [Fact]
    public void Part_RejectsANameOverTheLimit()
    {
        Should.Throw<DomainRuleException>(() =>
            IncomeSplitPart.Create("fixed", new string('a', IncomeSplitPart.MaxNameLength + 1), 50, 0, []));
    }

    [Fact]
    public void Plan_AllowsPercentagesThatDoNotAddUpTo100()
    {
        var plan = IncomeSplit.Create(950000, [Part("a", 70), Part("b", 60)]);

        plan.Parts.Sum(part => part.Percent).ShouldBe(130);
    }

    [Fact]
    public void Plan_RejectsACategoryInTwoParts()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            IncomeSplit.Create(0, [Part("a", 50, "food"), Part("b", 50, "food")]));

        exception.Message.ShouldContain("\"food\"");
    }

    [Fact]
    public void Plan_RejectsARepeatedPartId()
    {
        Should.Throw<DomainRuleException>(() => IncomeSplit.Create(0, [Part("a"), Part("a")]));
    }

    [Fact]
    public void Plan_RejectsMoreThanTheMaximumOfParts()
    {
        var parts = Enumerable.Range(0, IncomeSplit.MaxParts + 1).Select(number => Part($"part-{number}", 1)).ToList();

        Should.Throw<DomainRuleException>(() => IncomeSplit.Create(0, parts));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(MoneyTransaction.MaxAbsoluteAmountCents + 1)]
    public void Plan_RejectsAnIncomeOutOfRange(long baseIncomeCents)
    {
        Should.Throw<DomainRuleException>(() => IncomeSplit.Create(baseIncomeCents, []));
    }

    [Fact]
    public void Empty_HasNoIncomeAndNoParts()
    {
        (IncomeSplit.Empty.BaseIncomeCents, IncomeSplit.Empty.Parts.Count).ShouldBe((0L, 0));
    }
}
