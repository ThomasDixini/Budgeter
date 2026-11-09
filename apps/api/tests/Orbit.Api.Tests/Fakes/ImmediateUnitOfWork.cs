using Orbit.Api.Application;

namespace Orbit.Api.Tests.Fakes;

/// <summary>
/// Runs the work as it comes, for use case tests whose in-memory fakes have nothing to roll back.
/// Atomicity itself is covered against SQLite in <c>SqliteUnitOfWorkTests</c>.
/// </summary>
internal sealed class ImmediateUnitOfWork : IUnitOfWork
{
    public Task RunAsync(Func<Task> work, CancellationToken cancellationToken) => work();
}
