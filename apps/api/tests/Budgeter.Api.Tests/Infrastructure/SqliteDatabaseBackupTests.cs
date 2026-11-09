using Budgeter.Api.Application.Backups;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>The whole SQLite file goes out in a snapshot and comes back in a restore.</summary>
public sealed class SqliteDatabaseBackupTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly TemporarySqliteDatabase _otherDatabase = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteCategoryRepository _categories;
    private readonly SqliteDatabaseBackup _backup;

    public SqliteDatabaseBackupTests()
    {
        _connections = new SqliteConnectionFactory(_database.ConnectionString);
        _categories = new SqliteCategoryRepository(_connections);
        _backup = new SqliteDatabaseBackup(_connections);
    }

    public async Task InitializeAsync()
    {
        await EnsureCreatedAsync(_connections);
        await _categories.AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    public void Dispose()
    {
        _database.Dispose();
        _otherDatabase.Dispose();
    }

    [Fact]
    public async Task Restore_PutsBackWhatTheSnapshotHeld()
    {
        var snapshot = await SnapshotBytesAsync();
        await _categories.AddAsync(Category.Create("music", "Music", "#86EFAC"), CancellationToken.None);
        await _categories.DeleteAsync("study", CancellationToken.None);

        await _backup.RestoreAsync(new MemoryStream(snapshot), CancellationToken.None);

        (await CategoryIdsAsync()).ShouldBe(["study"]);
    }

    [Fact]
    public async Task Snapshot_IsDeletedOnceRead()
    {
        var snapshot = (FileStream)await _backup.OpenSnapshotAsync(CancellationToken.None);

        await snapshot.DisposeAsync();

        File.Exists(snapshot.Name).ShouldBeFalse();
    }

    [Fact]
    public async Task Restore_TextFileIsRejectedAndChangesNothing()
    {
        var error = await Should.ThrowAsync<InvalidBackupException>(
            () => _backup.RestoreAsync(new MemoryStream("not a database"u8.ToArray()), CancellationToken.None));

        error.Message.ShouldContain("14-byte file");
        (await CategoryIdsAsync()).ShouldBe(["study"]);
    }

    [Fact]
    public async Task Restore_OtherAppsSqliteFileIsRejectedNamingItsApplicationId()
    {
        await RunOnOtherDatabaseAsync("CREATE TABLE notes (id TEXT); PRAGMA application_id = 7;");
        var otherApps = await OtherDatabaseBytesAsync();

        var error = await Should.ThrowAsync<InvalidBackupException>(
            () => _backup.RestoreAsync(new MemoryStream(otherApps), CancellationToken.None));

        error.Message.ShouldContain("application_id 7");
        (await CategoryIdsAsync()).ShouldBe(["study"]);
    }

    [Fact]
    public async Task Restore_BackupOfANewerVersionIsRejectedNamingItsVersion()
    {
        var newer = SqliteMigrations.LatestVersion + 1;
        await RunOnOtherDatabaseAsync(
            $"CREATE TABLE notes (id TEXT); PRAGMA application_id = {SqliteSchema.ApplicationId}; PRAGMA user_version = {newer};");
        var fromNewerVersion = await OtherDatabaseBytesAsync();

        var error = await Should.ThrowAsync<InvalidBackupException>(
            () => _backup.RestoreAsync(new MemoryStream(fromNewerVersion), CancellationToken.None));

        error.Message.ShouldContain($"received version {newer}");
    }

    [Fact]
    public async Task Restore_TruncatedBackupIsRejected()
    {
        var snapshot = await SnapshotBytesAsync();

        await Should.ThrowAsync<InvalidBackupException>(
            () => _backup.RestoreAsync(new MemoryStream(snapshot[..(snapshot.Length / 2)]), CancellationToken.None));

        (await CategoryIdsAsync()).ShouldBe(["study"]);
    }

    // Tables added after the backup was taken (a new module, say) are created again on restore.
    [Fact]
    public async Task Restore_OlderBackupGetsTheTablesAddedSince()
    {
        await RunOnOtherDatabaseAsync(
            $"CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL); PRAGMA application_id = {SqliteSchema.ApplicationId};");

        await _backup.RestoreAsync(new MemoryStream(await OtherDatabaseBytesAsync()), CancellationToken.None);

        (await CategoryIdsAsync()).ShouldBeEmpty();
        (await new SqliteRoutineRepository(_connections).ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    private async Task<byte[]> SnapshotBytesAsync()
    {
        await using var snapshot = await _backup.OpenSnapshotAsync(CancellationToken.None);
        using var copy = new MemoryStream();
        await snapshot.CopyToAsync(copy);
        return copy.ToArray();
    }

    private async Task<IEnumerable<string>> CategoryIdsAsync() =>
        (await _categories.ListAsync(CancellationToken.None)).Select(category => category.Id);

    private async Task RunOnOtherDatabaseAsync(string sql)
    {
        await using var connection = await new SqliteConnectionFactory(_otherDatabase.ConnectionString)
            .OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(connection, sql, CancellationToken.None);
    }

    private async Task<byte[]> OtherDatabaseBytesAsync()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        var path = _otherDatabase.ConnectionString["Data Source=".Length..];
        return await File.ReadAllBytesAsync(path);
    }

    private static async Task EnsureCreatedAsync(SqliteConnectionFactory connections)
    {
        await using var connection = await connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
    }
}
