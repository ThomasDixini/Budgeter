using Orbit.Api.Domain;
using Orbit.Api.Domain.Routines;
using Shouldly;

namespace Orbit.Api.Tests.Domain;

public class RoutineRotationTests
{
    // November 2, 2026 is a Monday and November 8 the Sunday that closes its week.
    [Theory]
    [InlineData(2)]
    [InlineData(4)]
    [InlineData(8)]
    public void Create_StartsOnTheMondayOfTheGivenWeek(int dayOfNovember)
    {
        var rotation = RoutineRotation.Create(new DateOnly(2026, 11, dayOfNovember), []);

        rotation.StartsOn.ShouldBe(new DateOnly(2026, 11, 2));
    }

    [Fact]
    public void Create_KeepsTheStepsInOrder()
    {
        var steps = new[] { RotationStep.Create("normal", 2), RotationStep.Create("intense", 1), RotationStep.Create("light", 1) };

        var rotation = RoutineRotation.Create(new DateOnly(2026, 11, 2), steps);

        rotation.Steps.Select(step => (step.RoutineId, step.Weeks))
            .ShouldBe([("normal", 2), ("intense", 1), ("light", 1)]);
    }

    [Fact]
    public void RoutineIds_ListsEachRoutineOnce()
    {
        var steps = new[] { RotationStep.Create("normal", 2), RotationStep.Create("light", 1), RotationStep.Create("normal", 1) };

        RoutineRotation.Create(new DateOnly(2026, 11, 2), steps).RoutineIds.ShouldBe(["normal", "light"]);
    }

    [Fact]
    public void Create_RejectsMoreThanTwelveSteps()
    {
        var steps = Enumerable.Range(0, RoutineRotation.MaxSteps + 1).Select(_ => RotationStep.Create("normal", 1)).ToList();

        var exception = Should.Throw<DomainRuleException>(() => RoutineRotation.Create(new DateOnly(2026, 11, 2), steps));

        exception.Message.ShouldContain("13");
    }

    [Fact]
    public void Empty_HasNoSteps()
    {
        RoutineRotation.Empty.Steps.ShouldBeEmpty();
    }
}

public class RotationStepTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public void Create_RejectsWeeksOutsideOneToTwelve(int weeks)
    {
        var exception = Should.Throw<DomainRuleException>(() => RotationStep.Create("normal", weeks));

        exception.Message.ShouldContain(weeks.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public void Create_RejectsAnInvalidRoutineId()
    {
        var exception = Should.Throw<DomainRuleException>(() => RotationStep.Create("no spaces", 1));

        exception.Message.ShouldContain("\"no spaces\"");
    }
}
