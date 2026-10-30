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
        Remove(outcome.RoutineId, outcome.BlockId, outcome.Date);
        _outcomes.Add(outcome);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string routineId, string blockId, DateOnly date, CancellationToken cancellationToken)
    {
        Remove(routineId, blockId, date);
        return Task.CompletedTask;
    }

    private void Remove(string routineId, string blockId, DateOnly date)
    {
        _outcomes.RemoveAll(stored => stored.RoutineId == routineId && stored.BlockId == blockId && stored.Date == date);
    }
}
