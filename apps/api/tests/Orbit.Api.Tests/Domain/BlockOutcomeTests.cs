using Orbit.Api.Domain;
using Orbit.Api.Domain.Routines;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class BlockOutcomeTests
{
    [Theory]
    [InlineData("11h20")]
    [InlineData("24:00")]
    [InlineData("11:20\n")]
    public void Create_RejectsATimeNotShapedLikeAClock(string at)
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            BlockOutcome.Create("weekdays", "work", TestDays.Today, BlockOutcomeKind.Done, at));

        exception.Message.ShouldContain("HH:mm");
    }

    [Fact]
    public void Create_RejectsAMalformedBlockId()
    {
        Should.Throw<DomainRuleException>(() =>
            BlockOutcome.Create("weekdays", "has spaces", TestDays.Today, BlockOutcomeKind.Done, "11:20"));
    }
}
