using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Routine storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryRoutineRepository : IRoutineRepository
{
    private readonly List<Routine> _routines = [];

    public int SaveCount { get; private set; }

    public InMemoryRoutineRepository(params Routine[] routines)
    {
        _routines.AddRange(routines);
    }

    public Task<IReadOnlyList<Routine>> ListAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<Routine>>(_routines.ToList());
    }

    public Task SaveAsync(Routine routine, CancellationToken cancellationToken)
    {
        var index = _routines.FindIndex(stored => stored.Id == routine.Id);
        if (index < 0) _routines.Add(routine);
        else _routines[index] = routine;
        SaveCount++;
        return Task.CompletedTask;
    }
}
