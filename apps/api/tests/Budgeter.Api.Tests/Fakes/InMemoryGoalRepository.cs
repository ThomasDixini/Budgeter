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

    public Task<bool> AddAsync(Goal goal, CancellationToken cancellationToken)
    {
        if (_definitions.Exists(stored => stored.Id == goal.Id)) return Task.FromResult(false);
        _definitions.Add(goal.Definition);
        AddCount++;
        return Task.FromResult(true);
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

    public Task RemoveAchievementsAsync(string goalId, GoalWindow window, CancellationToken cancellationToken)
    {
        _events.RemoveAll(entry => IsAchievement(entry, goalId) && window.Contains(entry.Date));
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
        var window = GoalWindow.For(definition.Period, day, definition.Deadline);
        if (normalized.Type == GoalType.Objective)
        {
            var marks = _events
                .Where(entry => IsAchievement(entry, definition.Id) && entry.Date >= window.Start && entry.Date <= day)
                .Select(entry => (DateOnly?)entry.Date);
            return Goal.RestoreObjective(definition, marks.Min());
        }
        var inWindow = _events
            .Where(entry => entry.GoalId == definition.Id && entry.SourceRef != GoalAchievement.SourceRef && window.Contains(entry.Date))
            .ToList();
        var manual = inWindow.Where(entry => entry.Source == GoalSource.Manual).Sum(entry => entry.Amount);
        var automatic = inWindow.Where(entry => entry.Source != GoalSource.Manual).Sum(entry => entry.Amount);
        return Goal.Restore(definition, GoalProgress.Compute(manual, automatic));
    }

    private static bool IsAchievement(GoalProgressEvent entry, string goalId) =>
        entry.GoalId == goalId && entry.SourceRef == GoalAchievement.SourceRef;
}
