using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Creates the tables on startup; every statement is safe to run on an existing database. Every table that
/// holds a person's records has a leading <c>user_id</c> column, which is part of its primary key and of
/// every foreign key between such tables, so two people can use the same id and a row can only ever
/// point at a row of its own owner.
/// </summary>
internal static class SqliteSchema
{
    /// <summary>
    /// Stamped in SQLite's <c>application_id</c> header field so a restore can tell an Orbit database from
    /// any other SQLite file. It spells "Budg", from when the app was named Budgeter; it stays so backups
    /// taken back then can still be restored.
    /// </summary>
    public const int ApplicationId = 0x42756467;

    /// <summary>
    /// The <c>user_version</c> of a database in the current shape: 1-3 are the single-owner steps of
    /// <see cref="SqliteMigrations"/>, 4 is the move to one owner per row.
    /// </summary>
    public const int CurrentVersion = 4;

    /// <summary>The tables that hold a user's records, parents before the tables that point at them.</summary>
    public static readonly string[] UserTables =
    [
        "categories", "goals", "goal_progress", "routines", "routine_blocks", "routine_rotation",
        "routine_rotation_steps", "tasks", "task_completions", "block_outcomes", "sample_seed",
        "finance_categories", "accounts", "transactions", "card_payments", "bills", "investments",
        "investment_trades", "investment_incomes", "income_split", "income_split_parts",
        "income_split_categories", "finance_seed",
    ];

    private const string CreateTables = """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS categories (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS goals (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            period TEXT NOT NULL,
            target INTEGER NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            unit TEXT NULL,
            deadline TEXT NULL,
            tracking TEXT NOT NULL DEFAULT 'manual',
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, category_id) REFERENCES categories (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_goals_category_id ON goals (user_id, category_id);
        CREATE TABLE IF NOT EXISTS goal_progress (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            event_id TEXT NOT NULL,
            goal_id TEXT NOT NULL,
            date TEXT NOT NULL,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL,
            source_ref TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, event_id),
            FOREIGN KEY (user_id, goal_id) REFERENCES goals (user_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ix_goal_progress_goal_date ON goal_progress (user_id, goal_id, date);
        CREATE INDEX IF NOT EXISTS ix_goal_progress_source ON goal_progress (user_id, source, source_ref, date);
        CREATE TABLE IF NOT EXISTS routines (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            days TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS routine_blocks (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            routine_id TEXT NOT NULL,
            id TEXT NOT NULL,
            position INTEGER NOT NULL,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category_id TEXT NULL,
            PRIMARY KEY (user_id, routine_id, id),
            FOREIGN KEY (user_id, routine_id) REFERENCES routines (user_id, id) ON DELETE CASCADE,
            FOREIGN KEY (user_id, category_id) REFERENCES categories (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_routine_blocks_category_id ON routine_blocks (user_id, category_id);
        CREATE TABLE IF NOT EXISTS routine_rotation (
            user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            starts_on TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS routine_rotation_steps (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            routine_id TEXT NOT NULL,
            weeks INTEGER NOT NULL,
            PRIMARY KEY (user_id, position),
            FOREIGN KEY (user_id, routine_id) REFERENCES routines (user_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ix_routine_rotation_steps_routine ON routine_rotation_steps (user_id, routine_id);
        CREATE TABLE IF NOT EXISTS tasks (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            title TEXT NOT NULL,
            category_id TEXT NULL,
            repeat TEXT NOT NULL,
            days TEXT NOT NULL,
            date TEXT NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, category_id) REFERENCES categories (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS task_completions (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            task_id TEXT NOT NULL,
            date TEXT NOT NULL,
            PRIMARY KEY (user_id, task_id, date),
            FOREIGN KEY (user_id, task_id) REFERENCES tasks (user_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ix_task_completions_date ON task_completions (user_id, date);
        CREATE TABLE IF NOT EXISTS block_outcomes (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            routine_id TEXT NOT NULL,
            block_id TEXT NOT NULL,
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            at TEXT NOT NULL,
            PRIMARY KEY (user_id, routine_id, block_id, date),
            FOREIGN KEY (user_id, routine_id) REFERENCES routines (user_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ix_block_outcomes_date ON block_outcomes (user_id, date);
        CREATE TABLE IF NOT EXISTS sample_seed (
            user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS finance_categories (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS accounts (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            opening_balance_cents INTEGER NOT NULL DEFAULT 0,
            credit_limit_cents INTEGER NULL,
            closing_day INTEGER NULL,
            due_day INTEGER NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS transactions (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            category_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, category_id) REFERENCES finance_categories (user_id, id),
            FOREIGN KEY (user_id, account_id) REFERENCES accounts (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_transactions_date ON transactions (user_id, date);
        CREATE INDEX IF NOT EXISTS ix_transactions_account_date ON transactions (user_id, account_id, date);
        CREATE TABLE IF NOT EXISTS card_payments (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            from_account_id TEXT NOT NULL,
            date TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, card_id) REFERENCES accounts (user_id, id),
            FOREIGN KEY (user_id, from_account_id) REFERENCES accounts (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_card_payments_date ON card_payments (user_id, date);
        CREATE TABLE IF NOT EXISTS bills (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            kind TEXT NOT NULL,
            description TEXT NOT NULL,
            category_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            settled_on TEXT NULL,
            settled_account_id TEXT NULL,
            series_id TEXT NULL,
            recurrence TEXT NULL,
            series_number INTEGER NULL,
            series_count INTEGER NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, category_id) REFERENCES finance_categories (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_bills_due_date ON bills (user_id, due_date);
        CREATE INDEX IF NOT EXISTS ix_bills_settled_on ON bills (user_id, settled_on);
        CREATE TABLE IF NOT EXISTS investments (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            price_cents INTEGER NULL,
            priced_on TEXT NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS investment_trades (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            investment_id TEXT NOT NULL,
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            quantity_thousandths INTEGER NOT NULL,
            unit_price_cents INTEGER NOT NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, investment_id) REFERENCES investments (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_investment_trades_investment ON investment_trades (user_id, investment_id, date);
        CREATE TABLE IF NOT EXISTS investment_incomes (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            investment_id TEXT NOT NULL,
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            PRIMARY KEY (user_id, id),
            FOREIGN KEY (user_id, investment_id) REFERENCES investments (user_id, id)
        );
        CREATE INDEX IF NOT EXISTS ix_investment_incomes_investment ON investment_incomes (user_id, investment_id, date);
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
            user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            base_income_cents INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS income_split_parts (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            id TEXT NOT NULL,
            position INTEGER NOT NULL,
            name TEXT NOT NULL,
            percent INTEGER NOT NULL,
            color INTEGER NOT NULL,
            PRIMARY KEY (user_id, id)
        );
        CREATE TABLE IF NOT EXISTS income_split_categories (
            user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            category_id TEXT NOT NULL,
            part_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (user_id, category_id),
            FOREIGN KEY (user_id, category_id) REFERENCES finance_categories (user_id, id) ON DELETE CASCADE,
            FOREIGN KEY (user_id, part_id) REFERENCES income_split_parts (user_id, id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ix_income_split_categories_part ON income_split_categories (user_id, part_id);
        CREATE TABLE IF NOT EXISTS finance_seed (
            user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """;

    /// <summary>
    /// Creates any missing table or index. A database from before accounts existed (one that has tables but
    /// no <c>users</c>) first goes through the single-owner steps, then every row it holds is given to a
    /// placeholder owner that the first person to sign up takes over.
    /// </summary>
    /// <example><code>await SqliteSchema.EnsureCreatedAsync(connection, ct);</code></example>
    public static async Task EnsureCreatedAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        if (await SqliteMultiUserMigration.IsNeededAsync(connection, cancellationToken))
        {
            await SqliteLegacySchema.EnsureCreatedAsync(connection, cancellationToken);
            await SqliteMultiUserMigration.ApplyAsync(connection, CreateTables, cancellationToken);
        }
        await SqliteCommands.ExecuteAsync(connection, CreateTables, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, $"PRAGMA application_id = {ApplicationId}", cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, $"PRAGMA user_version = {CurrentVersion}", cancellationToken);
    }
}
