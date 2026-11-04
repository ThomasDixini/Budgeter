using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class TransactionMonthTests
{
    [Fact]
    public void Parse_ReadsTheFirstDayOfTheMonth()
    {
        TransactionMonth.Parse("2026-10").FirstDay.ShouldBe(new DateOnly(2026, 10, 1));
    }

    [Fact]
    public void NextFirstDay_CrossesTheYear()
    {
        TransactionMonth.Parse("2026-12").NextFirstDay.ShouldBe(new DateOnly(2027, 1, 1));
    }

    [Theory]
    [InlineData("2026-13")]
    [InlineData("2026-1")]
    [InlineData("2026-00")]
    [InlineData("0000-05")]
    [InlineData("2026-10\n")]
    [InlineData("october")]
    public void Parse_RejectsAnyOtherShape(string text)
    {
        var exception = Should.Throw<DomainRuleException>(() => TransactionMonth.Parse(text));

        exception.Message.ShouldContain("YYYY-MM");
    }
}
