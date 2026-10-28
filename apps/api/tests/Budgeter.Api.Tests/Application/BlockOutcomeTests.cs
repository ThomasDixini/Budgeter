using Budgeter.Api.Application;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Routines;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class BlockOutcomeTests
{
    private static readonly DateOnly Today = new(2026, 10, 27);
    private readonly InMemoryBlockOutcomeRepository _outcomes = new();
    private readonly InMemoryRoutineRepository _routines = new(Routines.Weekdays());

    private RecordBlockOutcome Record() => new(_outcomes, _routines);

    [Fact]
    public async Task Record_StoresTheOutcomeForTheDay()
    {
        await Record().ExecuteAsync(new("weekdays", "work", Today, BlockOutcomeKind.Done, "11:20"), CancellationToken.None);

        var outcome = (await new ListBlockOutcomes(_outcomes).ExecuteAsync(Today, CancellationToken.None)).Single();
        (outcome.BlockId, outcome.Kind, outcome.At).ShouldBe(("work", BlockOutcomeKind.Done, "11:20"));
        (await _outcomes.ListAsync(Today.AddDays(1), CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Record_AgainReplacesTheOutcome()
    {
        await Record().ExecuteAsync(new("weekdays", "work", Today, BlockOutcomeKind.Done, "11:20"), CancellationToken.None);

        await Record().ExecuteAsync(new("weekdays", "work", Today, BlockOutcomeKind.Skipped, "11:30"), CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).Single().Kind.ShouldBe(BlockOutcomeKind.Skipped);
    }

    [Theory]
    [InlineData("missing", "work", "\"missing\"")]
    [InlineData("weekdays", "missing", "\"missing\"")]
    public async Task Record_RejectsAnUnknownRoutineOrBlock(string routineId, string blockId, string named)
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            Record().ExecuteAsync(new(routineId, blockId, Today, BlockOutcomeKind.Done, "11:20"), CancellationToken.None));

        exception.Message.ShouldContain(named);
    }

    [Fact]
    public async Task Undo_RemovesTheOutcomeAndIgnoresOneAlreadyGone()
    {
        await Record().ExecuteAsync(new("weekdays", "work", Today, BlockOutcomeKind.Done, "11:20"), CancellationToken.None);
        var undo = new UndoBlockOutcome(_outcomes);

        await undo.ExecuteAsync("weekdays", "work", Today, CancellationToken.None);
        await undo.ExecuteAsync("weekdays", "work", Today, CancellationToken.None);

        (await _outcomes.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public void Create_RejectsATimeNotShapedLikeAClock()
    {
        Should.Throw<DomainRuleException>(() =>
            BlockOutcome.Create("weekdays", "work", Today, BlockOutcomeKind.Done, "11h20"));
    }
}
