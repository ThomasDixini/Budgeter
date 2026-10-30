using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>
/// Goal storage and progress log kept in lists, for use case tests. Goals handed to the constructor
/// start with their progress logged as one manual entry on <see cref="TestDays.Today"/>.
/// </summary>
internal sealed class InMemoryGoalRepository : IGoalRepository, IGoalProgressLedger
{
    private readonly List<GoalDefinition> _definitions = [];
    private readonly List<GoalProgressEvent> _events = [];

    public int AddCount { get; private set; }

    public IReadOnlyList<GoalProgressEvent> Events => _events;

    public InMemoryGoalRepository(params Goal[] goals)
    {
        foreach (var goal in goals)
        {
            _definitions.Add(goal.Definition);
            if (goal.Done > 0) _events.Add(new($"seed:{goal.Id}", goal.Id, TestDays.Today, goal.Done, GoalSource.Manual, ""));
        }
    }

    public Task<IReadOnlyList<Goal>> ListAsync(DateOnly day, CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<Goal>>(_definitions.Select(definition => Restore(definition, day)).ToList());
    }

    public Task<Goal?> FindAsync(string id, DateOnly day, CancellationToken cancellationToken)
    {
        var definition = _definitions.Find(candidate => candidate.Id == id);
        return Task.FromResult(definition is null ? null : Restore(definition, day));
    }

    public Task AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        _definitions.Add(goal.Definition);
        AddCount++;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(GoalDefinition definition, CancellationToken cancellationToken)
    {
        _definitions[_definitions.FindIndex(stored => stored.Id == definition.Id)] = definition;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        _definitions.RemoveAll(definition => definition.Id == id);
        _events.RemoveAll(entry => entry.GoalId == id);
        return Task.CompletedTask;
    }

    public Task RecordAsync(GoalProgressEvent entry, CancellationToken cancellationToken)
    {
        if (_events.All(stored => stored.EventId != entry.EventId)) _events.Add(entry);
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string eventId, CancellationToken cancellationToken)
    {
        _events.RemoveAll(entry => entry.EventId == eventId);
        return Task.CompletedTask;
    }

    public Task RemoveBySourceAsync(GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken)
    {
        _events.RemoveAll(entry => entry.Source == source && entry.SourceRef == sourceRef && entry.Date == day);
        return Task.CompletedTask;
    }

    private Goal Restore(GoalDefinition definition, DateOnly day)
    {
        var normalized = Goal.Create(definition).Definition;
        if (normalized.Type == GoalType.Objective)
        {
            var achievement = _events.Find(entry => entry.EventId == GoalAchievement.EntryId(definition.Id) && entry.Date <= day);
            return Goal.RestoreObjective(definition, achievement?.Date);
        }
        var window = GoalWindow.For(definition.Period, day, definition.Deadline);
        var inWindow = _events
            .Where(entry => entry.GoalId == definition.Id && entry.SourceRef != GoalAchievement.SourceRef && window.Contains(entry.Date))
            .ToList();
        var manual = inWindow.Where(entry => entry.Source == GoalSource.Manual).Sum(entry => entry.Amount);
        var automatic = inWindow.Where(entry => entry.Source != GoalSource.Manual).Sum(entry => entry.Amount);
        return Goal.Restore(definition, GoalProgress.Compute(manual, automatic));
    }
}
