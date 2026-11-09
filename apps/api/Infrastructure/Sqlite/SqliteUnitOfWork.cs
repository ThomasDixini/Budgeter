using Orbit.Api.Application;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Runs repository writes in one SQLite transaction.</summary>
public sealed class SqliteUnitOfWork(SqliteConnectionFactory connections) : IUnitOfWork
{
    public Task RunAsync(Func<Task> work, CancellationToken cancellationToken) =>
        connections.RunInUnitOfWorkAsync(work, cancellationToken);
}
