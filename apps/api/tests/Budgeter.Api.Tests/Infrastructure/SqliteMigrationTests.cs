using System.Globalization;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>A database created before the current schema is brought up to date, each step once.</summary>
public sealed class SqliteMigrationTests : IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly SqliteConnectionFactory _connections;

    public SqliteMigrationTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
    }

    public void Dispose() => _database.Dispose();

    /// <summary>The goals table as it was when progress was one number on the goal.</summary>
    private async Task CreateOldDatabaseAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL);
            INSERT INTO categories VALUES ('study', 'Study', '#7DD3FC');
            CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories (id),
                title TEXT NOT NULL, type TEXT NOT NULL, period TEXT NOT NULL,
                target INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, unit TEXT NULL, deadline TEXT NULL
            );
            INSERT INTO goals (id, category_id, title, type, period, target, done)
                VALUES ('g1', 'study', 'Study', 'frequency', 'weekly', 5, 3),
                       ('g2', 'study', 'Rest', 'frequency', 'weekly', 5, 0);
            """,
            CancellationToken.None);
    }

    private async Task MigrateAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        return (await SqliteCommands.QueryAsync(connection, sql, reader => reader.GetInt64(0), CancellationToken.None))[0];
    }

    /// <summary>
    /// The day SQLite dated the legacy entry on. Read back instead of taken from the test's clock, so the
    /// test cannot fail when midnight (or a Monday) falls between the migration and the check.
    /// </summary>
    private async Task<DateOnly> MigrationDayAsync()
    {
        await using var connection = await _connections.OpenAsync(CancellationToken.None);
        var days = await SqliteCommands.QueryAsync(
            connection, "SELECT date FROM goal_progress WHERE event_id = 'legacy:g1'",
            reader => DateOnly.ParseExact(reader.GetString(0), "yyyy-MM-dd", CultureInfo.InvariantCulture),
            CancellationToken.None);
        return days.Single();
    }

    [Fact]
    public async Task OldGoals_KeepTheirProgressAsOneManualEntry_AndCountBlocksFromNowOn()
    {
        await CreateOldDatabaseAsync();

        await MigrateAsync();

        var goals = new SqliteGoalRepository(_connections);
        var goal = (await goals.FindAsync("g1", await MigrationDayAsync(), CancellationToken.None))!;
        (goal.Definition.Tracking, goal.Done).ShouldBe((GoalTracking.Blocks, 3));
        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(1);
    }

    [Fact]
    public async Task TheVersionIsRecorded_SoAStepNeverRunsTwice()
    {
        await CreateOldDatabaseAsync();
        await MigrateAsync();
        var goals = new SqliteGoalRepository(_connections);
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DELETE FROM goal_progress", CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(0);
        (await CountAsync("PRAGMA user_version")).ShouldBe(3);
        (await goals.ListAsync(TestDays.Today, CancellationToken.None))
            .Select(goal => goal.Done).ShouldBe([0, 0]);
    }

    [Fact]
    public async Task AFreshDatabase_IsCreatedAtTheCurrentVersionWithNothingToMigrate()
    {
        await MigrateAsync();

        (await CountAsync("PRAGMA user_version")).ShouldBe(3);
        (await CountAsync("SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'tracking'")).ShouldBe(1);
    }

    [Fact]
    public async Task OldAccounts_GainAnOpeningBalanceAndCardsGetTheStarterTerms()
    {
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                """
                CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
                INSERT INTO accounts VALUES ('checking-account', 'Checking account', 'BankAccount'),
                                            ('credit-card', 'Credit card', 'CreditCard');
                PRAGMA user_version = 2;
                """,
                CancellationToken.None);
        }

        await MigrateAsync();

        var accounts = await new SqliteAccountRepository(_connections).ListAsync(CancellationToken.None);
        accounts.Select(account => (account.OpeningBalanceCents, account.Card))
            .ShouldBe([(0L, null), (0L, FinanceStarterSeed.CardTerms)]);
    }

    [Fact]
    public async Task StoredGoals_GetTheTrackingTheirTypeImplies()
    {
        await CreateOldDatabaseAsync();
        await MigrateAsync();
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                """
                INSERT INTO goals (id, category_id, title, type, period, target, unit, deadline, tracking)
                    VALUES ('g3', 'study', 'Course', 'objective', 'custom', 12, 'modules', '2026-12-15', 'blocks');
                UPDATE goals SET tracking = 'tasks' WHERE id = 'g2';
                PRAGMA user_version = 1;
                """,
                CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM goals WHERE id = 'g2' AND tracking = 'blocks'")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM goals WHERE id = 'g3' AND tracking = 'manual'")).ShouldBe(1);
    }
}
