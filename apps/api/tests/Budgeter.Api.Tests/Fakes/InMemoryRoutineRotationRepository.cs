using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;

namespace Budgeter.Api.Tests.Fakes;

/// <summary>Routine rotation storage kept in a field, for use case tests.</summary>
internal sealed class InMemoryRoutineRotationRepository : IRoutineRotationRepository
{
    private RoutineRotation _rotation = RoutineRotation.Empty;

    public int ReplaceCount { get; private set; }

    public Task<RoutineRotation> GetAsync(CancellationToken cancellationToken) => Task.FromResult(_rotation);

    public Task ReplaceAsync(RoutineRotation rotation, CancellationToken cancellationToken)
    {
        _rotation = rotation;
        ReplaceCount++;
        return Task.CompletedTask;
    }
}
