using Budgeter.Api.Application;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class SaveRoutineRotationTests
{
    private static readonly DateOnly Wednesday = new(2026, 11, 4);

    private readonly InMemoryRoutineRotationRepository _rotations = new();
    private readonly InMemoryRoutineRepository _routines = new(
        Routine.Create("normal", "Normal", [0, 1, 2, 3, 4], "08:00", "17:00", []),
        Routine.Create("intense", "Intense", [0, 1, 2, 3, 4], "07:00", "22:00", []));

    [Fact]
    public async Task ExecuteAsync_StoresTheRotationFromTheMondayOfItsWeek()
    {
        var command = new SaveRoutineRotationCommand(Wednesday, [new("normal", 2), new("intense", 1)]);

        await new SaveRoutineRotation(_rotations, _routines).ExecuteAsync(command, CancellationToken.None);

        var stored = await new GetRoutineRotation(_rotations).ExecuteAsync(CancellationToken.None);
        stored.StartsOn.ShouldBe(new DateOnly(2026, 11, 2));
        stored.Steps.Select(step => (step.RoutineId, step.Weeks)).ShouldBe([("normal", 2), ("intense", 1)]);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsAnUnknownRoutineWithoutSaving()
    {
        var command = new SaveRoutineRotationCommand(Wednesday, [new("normal", 2), new("light", 1)]);

        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            new SaveRoutineRotation(_rotations, _routines).ExecuteAsync(command, CancellationToken.None));

        exception.Message.ShouldContain("\"light\"");
        _rotations.ReplaceCount.ShouldBe(0);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsAnInvalidStepWithoutSaving()
    {
        var command = new SaveRoutineRotationCommand(Wednesday, [new("normal", 0)]);

        await Should.ThrowAsync<DomainRuleException>(() =>
            new SaveRoutineRotation(_rotations, _routines).ExecuteAsync(command, CancellationToken.None));

        _rotations.ReplaceCount.ShouldBe(0);
    }

    [Fact]
    public async Task ExecuteAsync_WithNoStepsTurnsTheRotationOff()
    {
        var saveRotation = new SaveRoutineRotation(_rotations, _routines);
        await saveRotation.ExecuteAsync(new(Wednesday, [new("normal", 2)]), CancellationToken.None);

        await saveRotation.ExecuteAsync(new(Wednesday, []), CancellationToken.None);

        (await _rotations.GetAsync(CancellationToken.None)).Steps.ShouldBeEmpty();
    }
}

public class GetRoutineRotationTests
{
    [Fact]
    public async Task ExecuteAsync_BeforeAnySaveIsTheEmptyRotation()
    {
        var rotation = await new GetRoutineRotation(new InMemoryRoutineRotationRepository())
            .ExecuteAsync(CancellationToken.None);

        rotation.ShouldBeSameAs(RoutineRotation.Empty);
    }
}
