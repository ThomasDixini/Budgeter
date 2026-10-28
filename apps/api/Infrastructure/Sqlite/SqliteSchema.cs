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
            deadline TEXT NULL,
            tracking TEXT NOT NULL DEFAULT 'manual'
        );
        CREATE INDEX IF NOT EXISTS ix_goals_category_id ON goals (category_id);
        CREATE TABLE IF NOT EXISTS goal_progress (
            event_id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL,
            source_ref TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_goal_progress_goal_date ON goal_progress (goal_id, date);
        CREATE INDEX IF NOT EXISTS ix_goal_progress_source ON goal_progress (source, source_ref, date);
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
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category_id TEXT NULL REFERENCES categories (id),
            repeat TEXT NOT NULL,
            days TEXT NOT NULL,
            date TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS task_completions (
            task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            PRIMARY KEY (task_id, date)
        );
        CREATE INDEX IF NOT EXISTS ix_task_completions_date ON task_completions (date);
        CREATE TABLE IF NOT EXISTS block_outcomes (
            routine_id TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
            block_id TEXT NOT NULL,
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            at TEXT NOT NULL,
            PRIMARY KEY (routine_id, block_id, date)
        );
        CREATE INDEX IF NOT EXISTS ix_block_outcomes_date ON block_outcomes (date);
        """;

    /// <summary>
    /// Creates any missing table or index, then brings an older database up to the current version.
    /// </summary>
    /// <example><code>await SqliteSchema.EnsureCreatedAsync(connection, ct);</code></example>
    public static async Task EnsureCreatedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, CreateTables, cancellationToken);
        await SqliteMigrations.ApplyAsync(connection, cancellationToken);
    }
}
