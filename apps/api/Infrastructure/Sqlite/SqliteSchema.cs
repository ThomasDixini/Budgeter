using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Creates the tables on startup; every statement is safe to run on an existing database.</summary>
internal static class SqliteSchema
{
    private const string CreateTables = """
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL REFERENCES categories (id),
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            period TEXT NOT NULL,
            target INTEGER NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            unit TEXT NULL,
            deadline TEXT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_goals_category_id ON goals (category_id);
        """;

    /// <summary>
    /// Creates any missing table or index.
    /// </summary>
    /// <example><code>await SqliteSchema.EnsureCreatedAsync(connection, ct);</code></example>
    public static Task EnsureCreatedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        return SqliteCommands.ExecuteAsync(connection, CreateTables, cancellationToken);
    }
}
