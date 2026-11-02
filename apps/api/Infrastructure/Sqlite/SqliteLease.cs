using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// A connection lent to one repository call. It is closed on dispose only when the call opened it;
/// one belonging to a unit of work stays open for the rest of that work.
/// </summary>
public sealed class SqliteLease(SqliteConnection connection, bool ownsConnection) : IAsyncDisposable
{
    public SqliteConnection Connection => connection;

    /// <summary>
    /// Runs the statements in one transaction; inside a unit of work they join its transaction instead,
    /// since SQLite has no nested transactions.
    /// </summary>
    /// <example><code>await lease.RunInTransactionAsync(() => WriteAsync(lease.Connection, routine, ct), ct);</code></example>
    public async Task RunInTransactionAsync(Func<Task> statements, CancellationToken cancellationToken)
    {
        if (!ownsConnection)
        {
            await statements();
            return;
        }
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await statements();
        await transaction.CommitAsync(cancellationToken);
    }

    public ValueTask DisposeAsync() => ownsConnection ? connection.DisposeAsync() : ValueTask.CompletedTask;
}
