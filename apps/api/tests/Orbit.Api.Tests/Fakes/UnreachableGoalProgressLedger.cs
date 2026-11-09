using Orbit.Api.Application.Goals;
using Orbit.Api.Domain.Goals;

namespace Orbit.Api.Tests.Fakes;

/// <summary>A progress log whose every write fails, as when the disk is full halfway through a request.</summary>
internal sealed class UnreachableGoalProgressLedger : IGoalProgressLedger
{
    public Task RecordAsync(GoalProgressEvent entry, CancellationToken cancellationToken) => Fail();

    public Task RemoveAchievementsAsync(string goalId, GoalWindow window, CancellationToken cancellationToken) => Fail();

    public Task RemoveBySourceAsync(GoalSource source, string sourceRef, DateOnly day, CancellationToken cancellationToken) =>
        Fail();

    private static Task Fail() =>
        Task.FromException(new IOException("Expected the progress log to accept writes, received a simulated failure"));
}
