using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Opens SQLite connections with foreign keys enforced.</summary>
public sealed class SqliteConnectionFactory(string connectionString)
{
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
}
