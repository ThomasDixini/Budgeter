using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Infrastructure.Sqlite;
using Microsoft.Data.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>A database created before goal progress became a log is brought up to date once.</summary>
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

    [Fact]
    public async Task OldGoals_GainTrackingAndKeepTheirProgressAsOneManualEntry()
    {
        await CreateOldDatabaseAsync();

        await MigrateAsync();

        var goals = new SqliteGoalRepository(_connections);
        var today = DateOnly.FromDateTime(DateTime.Now);
        var goal = (await goals.FindAsync("g1", today, CancellationToken.None))!;
        (goal.Definition.Tracking, goal.Done).ShouldBe((GoalTracking.Manual, 3));
        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(1);
    }

    [Fact]
    public async Task TheVersionIsRecorded_SoAStepNeverRunsTwice()
    {
        await CreateOldDatabaseAsync();
        await MigrateAsync();
        var goals = new SqliteGoalRepository(_connections);
        await new SqliteGoalProgressLedger(_connections).RemoveAutomaticAsync("g1", CancellationToken.None);
        await using (var connection = await _connections.OpenAsync(CancellationToken.None))
        {
            await SqliteCommands.ExecuteAsync(connection, "DELETE FROM goal_progress", CancellationToken.None);
        }

        await MigrateAsync();

        (await CountAsync("SELECT COUNT(*) FROM goal_progress")).ShouldBe(0);
        (await CountAsync("PRAGMA user_version")).ShouldBe(1);
        (await goals.ListAsync(DateOnly.FromDateTime(DateTime.Now), CancellationToken.None))
            .Select(goal => goal.Done).ShouldBe([0, 0]);
    }

    [Fact]
    public async Task AFreshDatabase_IsCreatedAtTheCurrentVersionWithNothingToMigrate()
    {
        await MigrateAsync();

        (await CountAsync("PRAGMA user_version")).ShouldBe(1);
        (await CountAsync("SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'tracking'")).ShouldBe(1);
    }
}
