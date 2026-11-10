using Orbit.Api.Domain.Routines;

namespace Orbit.Api.Application.Routines;

public sealed record RotationStepCommand(string RoutineId, int Weeks);

public sealed record SaveRoutineRotationCommand(DateOnly StartsOn, IReadOnlyList<RotationStepCommand> Steps);

/// <summary>Replaces the routine rotation; saving the same rotation twice leaves the same state.</summary>
public sealed class SaveRoutineRotation(IRoutineRotationRepository rotations, IRoutineRepository routines)
{
    /// <summary>
    /// Validates the rotation, checks every routine in it exists and stores it over the previous one.
    /// </summary>
    /// <example><code>await saveRoutineRotation.ExecuteAsync(new(new DateOnly(2026, 11, 2), [new("normal", 2), new("light", 1)]), ct);</code></example>
    public async Task<RoutineRotation> ExecuteAsync(SaveRoutineRotationCommand command, CancellationToken cancellationToken)
    {
        var steps = command.Steps.Select(step => RotationStep.Create(step.RoutineId, step.Weeks)).ToList();
        var rotation = RoutineRotation.Create(command.StartsOn, steps);
        await RequireRoutinesAsync(rotation, cancellationToken);
        await rotations.ReplaceAsync(rotation, cancellationToken);
        return rotation;
    }

    private async Task RequireRoutinesAsync(RoutineRotation rotation, CancellationToken cancellationToken)
    {
        var known = (await routines.ListAsync(cancellationToken)).Select(routine => routine.Id).ToHashSet();
        var unknown = rotation.RoutineIds.FirstOrDefault(id => !known.Contains(id));
        if (unknown is not null) throw ResourceNotFoundException.For("routine", unknown);
    }
}
