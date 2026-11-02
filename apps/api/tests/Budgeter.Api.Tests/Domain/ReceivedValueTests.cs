using Budgeter.Api.Domain;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class ReceivedValueTests
{
    [Fact]
    public void Quote_ShowsAShortValueWhole()
    {
        ReceivedValue.Quote("blue").ShouldBe("\"blue\"");
    }

    [Fact]
    public void Quote_CutsALongValueShortAndSaysHowLongItWas()
    {
        var quoted = ReceivedValue.Quote(new string('x', 10_000));

        quoted.ShouldBe($"\"{new string('x', 80)}…\" (10000 characters)");
    }

    [Fact]
    public void RequiredText_DoesNotEchoAHugeValueIntoTheMessage()
    {
        var exception = Should.Throw<DomainRuleException>(() =>
            RequiredText.Require(new string('t', 100_000), 40, "category name"));

        exception.Message.Length.ShouldBeLessThan(300);
        exception.Message.ShouldContain("(100000 characters)");
    }
}
