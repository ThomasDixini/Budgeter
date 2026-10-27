using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Block outcome storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryBlockOutcomeRepository : IBlockOutcomeRepository
{
    private readonly List<BlockOutcome> _outcomes = [];

    public Task<IReadOnlyList<BlockOutcome>> ListAsync(DateOnly date, CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<BlockOutcome>>(_outcomes.Where(outcome => outcome.Date == date).ToList());
    }

    public Task SaveAsync(BlockOutcome outcome, CancellationToken cancellationToken)
    {
        _outcomes.RemoveAll(stored =>
            stored.RoutineId == outcome.RoutineId && stored.BlockId == outcome.BlockId && stored.Date == outcome.Date);
        _outcomes.Add(outcome);
        return Task.CompletedTask;
    }
}
