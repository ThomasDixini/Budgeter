using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Creates the tables on startup; every statement is safe to run on an existing database.</summary>
internal static class SqliteSchema
{
    /// <summary>
    /// Stamped in SQLite's <c>application_id</c> header field so a restore can tell an Orbit database from
    /// any other SQLite file. It spells "Budg", from when the app was named Budgeter; it stays so backups
    /// taken back then can still be restored.
    /// </summary>
    public const int ApplicationId = 0x42756467;

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
        CREATE TABLE IF NOT EXISTS routine_rotation (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            starts_on TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS routine_rotation_steps (
            position INTEGER PRIMARY KEY,
            routine_id TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
            weeks INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_routine_rotation_steps_routine ON routine_rotation_steps (routine_id);
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
        CREATE TABLE IF NOT EXISTS sample_seed (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS finance_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            opening_balance_cents INTEGER NOT NULL DEFAULT 0,
            credit_limit_cents INTEGER NULL,
            closing_day INTEGER NULL,
            due_day INTEGER NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            category_id TEXT NOT NULL REFERENCES finance_categories (id),
            account_id TEXT NOT NULL REFERENCES accounts (id),
            amount_cents INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_transactions_date ON transactions (date);
        CREATE INDEX IF NOT EXISTS ix_transactions_account_date ON transactions (account_id, date);
        CREATE TABLE IF NOT EXISTS card_payments (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES accounts (id),
            from_account_id TEXT NOT NULL REFERENCES accounts (id),
            date TEXT NOT NULL,
            amount_cents INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_card_payments_date ON card_payments (date);
        CREATE TABLE IF NOT EXISTS bills (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            description TEXT NOT NULL,
            category_id TEXT NOT NULL REFERENCES finance_categories (id),
            amount_cents INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            settled_on TEXT NULL,
            settled_account_id TEXT NULL,
            series_id TEXT NULL,
            recurrence TEXT NULL,
            series_number INTEGER NULL,
            series_count INTEGER NULL
        );
        CREATE INDEX IF NOT EXISTS ix_bills_due_date ON bills (due_date);
        CREATE INDEX IF NOT EXISTS ix_bills_settled_on ON bills (settled_on);
        CREATE TABLE IF NOT EXISTS investments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            price_cents INTEGER NULL,
            priced_on TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS investment_trades (
            id TEXT PRIMARY KEY,
            investment_id TEXT NOT NULL REFERENCES investments (id),
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            quantity_thousandths INTEGER NOT NULL,
            unit_price_cents INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_investment_trades_investment ON investment_trades (investment_id, date);
        CREATE TABLE IF NOT EXISTS investment_incomes (
            id TEXT PRIMARY KEY,
            investment_id TEXT NOT NULL REFERENCES investments (id),
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            amount_cents INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_investment_incomes_investment ON investment_incomes (investment_id, date);
        CREATE TABLE IF NOT EXISTS cdi_rates (
            date TEXT PRIMARY KEY,
            daily_percent TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS month_end_prices (
            symbol TEXT NOT NULL,
            month TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            PRIMARY KEY (symbol, month)
        );
        CREATE TABLE IF NOT EXISTS income_split (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            base_income_cents INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS income_split_parts (
            id TEXT PRIMARY KEY,
            position INTEGER NOT NULL,
            name TEXT NOT NULL,
            percent INTEGER NOT NULL,
            color INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS income_split_categories (
            category_id TEXT PRIMARY KEY REFERENCES finance_categories (id) ON DELETE CASCADE,
            part_id TEXT NOT NULL REFERENCES income_split_parts (id) ON DELETE CASCADE,
            position INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_income_split_categories_part ON income_split_categories (part_id);
        CREATE TABLE IF NOT EXISTS finance_seed (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """;

    /// <summary>
    /// Creates any missing table or index, then brings an older database up to the current version.
    /// </summary>
    /// <example><code>await SqliteSchema.EnsureCreatedAsync(connection, ct);</code></example>
    public static async Task EnsureCreatedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, CreateTables, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, $"PRAGMA application_id = {ApplicationId}", cancellationToken);
        await SqliteMigrations.ApplyAsync(connection, cancellationToken);
    }
}
