using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Goal storage kept in a dictionary of progress, for use case tests.</summary>
internal sealed class InMemoryGoalRepository : IGoalRepository
{
    private readonly List<GoalDefinition> _definitions = [];
    private readonly Dictionary<string, int> _progress = [];

    public int AddCount { get; private set; }

    public InMemoryGoalRepository(params Goal[] goals)
    {
        foreach (var goal in goals) Store(goal);
    }

    public Task<IReadOnlyList<Goal>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<Goal>>(_definitions.Select(Restore).ToList());
    }

    public Task<Goal?> FindAsync(string id, CancellationToken cancellationToken)
    {
        var definition = _definitions.Find(candidate => candidate.Id == id);
        return Task.FromResult(definition is null ? null : Restore(definition));
    }

    public Task AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        Store(goal);
        AddCount++;
        return Task.CompletedTask;
    }

    public Task SaveProgressAsync(Goal goal, CancellationToken cancellationToken)
    {
        _progress[goal.Id] = goal.Done;
        return Task.CompletedTask;
    }

    private void Store(Goal goal)
    {
        _definitions.Add(goal.Definition);
        _progress[goal.Id] = goal.Done;
    }

    private Goal Restore(GoalDefinition definition) => Goal.Restore(definition, _progress[definition.Id]);
}
