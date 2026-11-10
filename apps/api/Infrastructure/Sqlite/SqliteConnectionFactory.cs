using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Opens SQLite connections with foreign keys enforced. While a unit of work runs, repositories are
/// lent its connection, so their statements join its transaction.
/// </summary>
public sealed class SqliteConnectionFactory(string connectionString)
{
    // Flows with the async calls of one request only, so concurrent requests never share it.
    private readonly AsyncLocal<SqliteConnection?> _unitOfWorkConnection = new();

    /// <summary>
    /// Opens a new connection; the caller disposes it.
    /// </summary>
    /// <example><code>await using var connection = await factory.OpenAsync(ct);</code></example>
    public async Task<SqliteConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "PRAGMA foreign_keys = ON;", cancellationToken);
        return connection;
    }

    /// <summary>
    /// The connection for one repository call: the running unit of work's, or a new one otherwise.
    /// </summary>
    /// <example><code>await using var lease = await factory.LeaseAsync(ct); var connection = lease.Connection;</code></example>
    public async Task<SqliteLease> LeaseAsync(CancellationToken cancellationToken)
    {
        var shared = _unitOfWorkConnection.Value;
        return shared is null
            ? new SqliteLease(await OpenAsync(cancellationToken), ownsConnection: true)
            : new SqliteLease(shared, ownsConnection: false);
    }

    /// <summary>
    /// Runs the work in one transaction that every lease taken inside it joins; a unit of work started
    /// inside another one joins the outer one.
    /// </summary>
    /// <example><code>await factory.RunInUnitOfWorkAsync(() => repository.SaveAsync(routine, ct), ct);</code></example>
    internal async Task RunInUnitOfWorkAsync(Func<Task> work, CancellationToken cancellationToken)
    {
        if (_unitOfWorkConnection.Value is not null)
        {
            await work();
            return;
        }
        await using var connection = await OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        _unitOfWorkConnection.Value = connection;
        try
        {
            await work();
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            _unitOfWorkConnection.Value = null;
        }
    }
}
