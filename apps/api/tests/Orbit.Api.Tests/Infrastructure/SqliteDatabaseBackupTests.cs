using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Backups;
using Orbit.Api.Domain.Categories;
using Orbit.Api.Infrastructure.Sqlite;
using Shouldly;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>One account's data goes out in a snapshot and comes back in a restore, and nobody else's does.</summary>
public sealed class SqliteDatabaseBackupTests : IAsyncLifetime, IDisposable
{
    private readonly TemporarySqliteDatabase _database = new();
    private readonly TemporarySqliteDatabase _otherDatabase = new();
    private readonly SqliteConnectionFactory _connections;
    private readonly SqliteConnectionFactory _otherUsersConnections;
    private readonly SqliteCategoryRepository _categories;
    private readonly SqliteCategoryRepository _otherUsersCategories;
    private readonly SqliteDatabaseBackup _backup;

    public SqliteDatabaseBackupTests()
    {
        _connections = TestUsers.FactoryFor(_database);
        _otherUsersConnections = TestUsers.FactoryFor(_database, TestUsers.OtherId);
        _categories = new SqliteCategoryRepository(_connections);
        _otherUsersCategories = new SqliteCategoryRepository(_otherUsersConnections);
        _backup = new SqliteDatabaseBackup(_connections);
    }

    public async Task InitializeAsync()
    {
        await TestUsers.CreateSchemaAsync(_connections, TestUsers.DefaultId, TestUsers.OtherId);
        await _categories.AddAsync(Category.Create("study", "Study", "#7DD3FC"), CancellationToken.None);
        await _otherUsersCategories.AddAsync(Category.Create("secret", "Secret", "#FCA5A5"), CancellationToken.None);
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
    public async Task Snapshot_HoldsOnlyTheSignedInUsersRecords()
    {
        var snapshot = await SnapshotBytesAsync();

        var text = System.Text.Encoding.UTF8.GetString(snapshot);

        text.ShouldContain("Study");
        text.ShouldNotContain("Secret");
    }

    [Fact]
    public async Task Snapshot_HoldsNoEmailOrPasswordHash()
    {
        var snapshot = await SnapshotBytesAsync();

        var text = System.Text.Encoding.UTF8.GetString(snapshot);

        text.ShouldNotContain($"{TestUsers.DefaultId}@test.local");
        text.ShouldNotContain($"{TestUsers.OtherId}@test.local");
    }

    [Fact]
    public async Task Restore_ChangesNothingForTheOtherUsers()
    {
        var snapshot = await SnapshotBytesAsync();
        await _categories.DeleteAsync("study", CancellationToken.None);

        await _backup.RestoreAsync(new MemoryStream(snapshot), CancellationToken.None);

        (await _otherUsersCategories.ListAsync(CancellationToken.None)).Select(category => category.Id)
            .ShouldBe(["secret"]);
    }

    [Fact]
    public async Task Restore_ASnapshotOfAnotherAccountFillsTheSignedInOne()
    {
        var snapshot = await SnapshotBytesAsync(new SqliteDatabaseBackup(_otherUsersConnections));

        await _backup.RestoreAsync(new MemoryStream(snapshot), CancellationToken.None);

        (await CategoryIdsAsync()).ShouldBe(["secret"]);
        (await _otherUsersCategories.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
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
        var newer = SqliteSchema.CurrentVersion + 1;
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

    [Fact]
    public async Task Restore_ABackupWithSeveralAccountsIsRejectedAndChangesNothing()
    {
        await RunOnOtherDatabaseAsync(
            $"""
            PRAGMA application_id = {SqliteSchema.ApplicationId};
            CREATE TABLE categories (user_id TEXT, id TEXT, name TEXT, color TEXT);
            INSERT INTO categories VALUES ('a', 'x', 'X', '#000000'), ('b', 'y', 'Y', '#000000');
            PRAGMA user_version = {SqliteSchema.CurrentVersion};
            """);

        var severalAccounts = await OtherDatabaseBytesAsync();

        await Should.ThrowAsync<InvalidBackupException>(
            () => _backup.RestoreAsync(new MemoryStream(severalAccounts), CancellationToken.None));

        (await CategoryIdsAsync()).ShouldBe(["study"]);
    }

    // A file taken before accounts existed has no owner column: its rows become the signed-in user's, and
    // what it lacks (tables added since) is created again.
    [Fact]
    public async Task Restore_ABackupFromBeforeAccountsBecomesTheSignedInUsersData()
    {
        await RunOnOtherDatabaseAsync(
            $"""
            CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL);
            INSERT INTO categories VALUES ('old', 'Old', '#7DD3FC');
            PRAGMA application_id = {SqliteSchema.ApplicationId};
            """);

        await _backup.RestoreAsync(new MemoryStream(await OtherDatabaseBytesAsync()), CancellationToken.None);

        (await CategoryIdsAsync()).ShouldBe(["old"]);
        (await new SqliteRoutineRepository(_connections).ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    private async Task<byte[]> SnapshotBytesAsync(SqliteDatabaseBackup? from = null)
    {
        await using var snapshot = await (from ?? _backup).OpenSnapshotAsync(CancellationToken.None);
        using var copy = new MemoryStream();
        await snapshot.CopyToAsync(copy);
        return copy.ToArray();
    }

    private async Task<IEnumerable<string>> CategoryIdsAsync() =>
        (await _categories.ListAsync(CancellationToken.None)).Select(category => category.Id);

    private async Task RunOnOtherDatabaseAsync(string sql)
    {
        await using var connection = await TestUsers.FactoryFor(_otherDatabase)
            .OpenAsync(CancellationToken.None);
        await SqliteCommands.ExecuteAsync(connection, sql, CancellationToken.None);
    }

    private async Task<byte[]> OtherDatabaseBytesAsync()
    {
        SqliteConnection.ClearAllPools();
        var path = _otherDatabase.ConnectionString["Data Source=".Length..];
        return await File.ReadAllBytesAsync(path);
    }
}
