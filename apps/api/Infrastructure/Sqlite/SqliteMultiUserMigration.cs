using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Version 4: every record gets an owner. SQLite cannot change a primary key, so each table is rebuilt in its
/// new shape and its rows are copied under a placeholder owner (an account with an empty password hash, which
/// nobody can sign in to). <see cref="SqliteUserRepository"/> hands that account over to the first person
/// who signs up, so the data a single-user install already held is not lost.
/// </summary>
internal static class SqliteMultiUserMigration
{
    /// <summary>E-mail of the placeholder owner; not routable, so it can never collide with a real address.</summary>
    public const string PlaceholderEmail = "unclaimed@orbit.invalid";

    /// <summary>
    /// Tells whether the database predates accounts: it has tables, but no <c>users</c> table and a
    /// <c>user_version</c> below 4. A new, empty database does not need it.
    /// </summary>
    /// <example><code>if (await SqliteMultiUserMigration.IsNeededAsync(connection, ct)) { ... }</code></example>
    public static async Task<bool> IsNeededAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var version = await ScalarAsync(connection, "PRAGMA user_version", cancellationToken);
        if (version >= SqliteSchema.CurrentVersion) return false;
        var hasUsers = await ScalarAsync(
            connection, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'users'", cancellationToken);
        var tables = await ScalarAsync(
            connection,
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            cancellationToken);
        return hasUsers == 0 && tables > 0;
    }

    /// <summary>
    /// Moves every user table to its new shape (<paramref name="createTables"/> creates them) and copies the
    /// rows under the placeholder owner, all in one transaction.
    /// </summary>
    /// <example><code>await SqliteMultiUserMigration.ApplyAsync(connection, createTables, ct);</code></example>
    public static async Task ApplyAsync(
        SqliteConnection connection, string createTables, CancellationToken cancellationToken)
    {
        // Foreign keys cannot be switched inside a transaction, and the tables are dropped and renamed
        // while rows still point at them.
        await SqliteCommands.ExecuteAsync(connection, "PRAGMA foreign_keys = OFF;", cancellationToken);
        try
        {
            await RebuildAsync(connection, createTables, cancellationToken);
            await RequireNoBrokenReferencesAsync(connection, cancellationToken);
        }
        finally
        {
            await SqliteCommands.ExecuteAsync(connection, "PRAGMA foreign_keys = ON;", cancellationToken);
        }
    }

    private static async Task RebuildAsync(
        SqliteConnection connection, string createTables, CancellationToken cancellationToken)
    {
        await using var transaction = connection.BeginTransaction(deferred: false);
        await DropStarterMarkersAsync(connection, cancellationToken);
        var existing = await ExistingTablesAsync(connection, cancellationToken);
        await SetAsideAsync(connection, existing, cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, createTables, cancellationToken);
        var owner = await InsertPlaceholderOwnerAsync(connection, cancellationToken);
        foreach (var table in existing) await CopyAsync(connection, table, owner, cancellationToken);
        foreach (var table in existing.AsEnumerable().Reverse()) await DropLegacyAsync(connection, table, cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection, $"PRAGMA user_version = {SqliteSchema.CurrentVersion}", cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    // Accounts start empty, so the markers that kept the old starter data from coming back have no use.
    private static async Task DropStarterMarkersAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, "DROP TABLE IF EXISTS sample_seed", cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "DROP TABLE IF EXISTS finance_seed", cancellationToken);
    }

    private static async Task<IReadOnlyList<string>> ExistingTablesAsync(
        SqliteConnection connection, CancellationToken cancellationToken)
    {
        var names = await SqliteCommands.QueryAsync(
            connection,
            "SELECT name FROM sqlite_master WHERE type = 'table'",
            reader => reader.GetString(0),
            cancellationToken);
        return SqliteSchema.UserTables.Where(names.Contains).ToList();
    }

    // Index names outlive a renamed table, and "CREATE INDEX IF NOT EXISTS" would then skip the new index.
    private static async Task SetAsideAsync(
        SqliteConnection connection, IReadOnlyList<string> tables, CancellationToken cancellationToken)
    {
        foreach (var table in tables)
        {
            var indexes = await SqliteCommands.QueryAsync(
                connection,
                "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = $table AND sql IS NOT NULL",
                reader => reader.GetString(0),
                cancellationToken,
                ("$table", table));
            foreach (var index in indexes)
            {
                await SqliteCommands.ExecuteAsync(connection, $"DROP INDEX \"{index}\"", cancellationToken);
            }
            await SqliteCommands.ExecuteAsync(
                connection, $"ALTER TABLE \"{table}\" RENAME TO \"{table}_legacy\"", cancellationToken);
        }
    }

    private static async Task<string> InsertPlaceholderOwnerAsync(
        SqliteConnection connection, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid().ToString();
        await SqliteCommands.ExecuteAsync(
            connection,
            "INSERT INTO users (id, email, name, password_hash) VALUES ($id, $email, 'Orbit', '')",
            cancellationToken,
            ("$id", id), ("$email", PlaceholderEmail));
        return id;
    }

    // Only the columns both shapes have are copied: the single-row tables lose their "id = 1" column.
    private static async Task CopyAsync(
        SqliteConnection connection, string table, string owner, CancellationToken cancellationToken)
    {
        var columns = await SqliteCommands.QueryAsync(
            connection,
            $"""
            SELECT o.name FROM pragma_table_info('{table}_legacy') o
            JOIN pragma_table_info('{table}') n ON n.name = o.name
            """,
            reader => reader.GetString(0),
            cancellationToken);
        var list = string.Join(", ", columns.Select(column => $"\"{column}\""));
        await SqliteCommands.ExecuteAsync(
            connection,
            $"INSERT INTO \"{table}\" (user_id, {list}) SELECT $owner, {list} FROM \"{table}_legacy\"",
            cancellationToken,
            ("$owner", owner));
    }

    private static Task DropLegacyAsync(SqliteConnection connection, string table, CancellationToken cancellationToken) =>
        SqliteCommands.ExecuteAsync(connection, $"DROP TABLE \"{table}_legacy\"", cancellationToken);

    private static async Task RequireNoBrokenReferencesAsync(
        SqliteConnection connection, CancellationToken cancellationToken)
    {
        var broken = await SqliteCommands.QueryAsync(
            connection, "PRAGMA foreign_key_check", reader => reader.GetString(0), cancellationToken);
        if (broken.Count == 0) return;
        throw new InvalidOperationException(
            $"Expected every record to point at a record of the same owner after the move to accounts, received dangling references in {string.Join(", ", broken.Distinct())}");
    }

    private static async Task<long> ScalarAsync(
        SqliteConnection connection, string sql, CancellationToken cancellationToken)
    {
        var values = await SqliteCommands.QueryAsync(connection, sql, reader => reader.GetInt64(0), cancellationToken);
        return values[0];
    }
}
