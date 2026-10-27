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
        CREATE TABLE IF NOT EXISTS routines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            days TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS routine_blocks (
            routine_id TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            position INTEGER NOT NULL,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category_id TEXT NULL REFERENCES categories (id),
            PRIMARY KEY (routine_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_routine_blocks_category_id ON routine_blocks (category_id);
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
