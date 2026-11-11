using Orbit.Api.Application.Backups;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Backs up and restores one account's data as a SQLite file. The file only ever holds the signed-in user's
/// rows: a snapshot is built by copying them into a new database, so nobody else's data is written outside
/// the live file, and a restore replaces only the signed-in user's rows.
/// </summary>
public sealed class SqliteDatabaseBackup(SqliteConnectionFactory connections) : IDatabaseBackup
{
    private const int CopyBufferBytes = 81920;

    // Name the backup file goes by while its rows are copied into the live database.
    private const string BackupSchema = "backup";

    public async Task<Stream> OpenSnapshotAsync(CancellationToken cancellationToken)
    {
        var path = TemporaryPath();
        try
        {
            await WriteSnapshotAsync(path, connections.UserId, cancellationToken);
            return OpenAndDeleteOnClose(path);
        }
        catch
        {
            File.Delete(path);
            throw;
        }
    }

    public async Task RestoreAsync(Stream backup, CancellationToken cancellationToken)
    {
        var path = TemporaryPath();
        try
        {
            await SaveUploadAsync(backup, path, cancellationToken);
            var version = await RequireUsableAsync(path, cancellationToken);
            if (version < SqliteSchema.CurrentVersion) await UpgradeAsync(path, cancellationToken);
            await ReplaceRowsAsync(path, connections.UserId, cancellationToken);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(path);
        }
    }

    // A new database, in the current shape, that receives this user's rows and nothing else.
    private async Task WriteSnapshotAsync(string path, string userId, CancellationToken cancellationToken)
    {
        await using var live = await connections.OpenAsync(cancellationToken);
        await using var snapshot = await OpenNewDatabaseAsync(path, cancellationToken);
        await SqliteSchema.EnsureCreatedAsync(snapshot, cancellationToken);
        await SqliteCommands.ExecuteAsync(
            snapshot, "ATTACH DATABASE $path AS live", cancellationToken, ("$path", live.DataSource));
        await using var transaction = snapshot.BeginTransaction();
        await CopyAccountAsync(snapshot, userId, cancellationToken);
        await SqliteUserRows.CopyAllAsync(snapshot, "live", userId, userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    // The account row keeps the name but not the e-mail or the password hash: a backup file is meant to be
    // kept and moved around, and holds no credentials.
    private static Task<int> CopyAccountAsync(SqliteConnection snapshot, string userId, CancellationToken cancellationToken) =>
        SqliteCommands.ExecuteAsync(
            snapshot,
            "INSERT INTO users (id, email, name, password_hash) SELECT id, $placeholder, name, '' FROM live.users WHERE id = $user",
            cancellationToken,
            ("$user", userId), ("$placeholder", SqliteMultiUserMigration.PlaceholderEmail));

    private static async Task<SqliteConnection> OpenNewDatabaseAsync(string path, CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(
            new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString());
        await connection.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "PRAGMA foreign_keys = ON;", cancellationToken);
        return connection;
    }

    // Returns the schema version of the file after proving it is an intact backup of one account.
    private static async Task<long> RequireUsableAsync(string path, CancellationToken cancellationToken)
    {
        await using var source = await SqliteBackupFile.OpenValidatedAsync(path, cancellationToken);
        if (await SqliteUserRows.HasSeveralOwnersAsync(source, "main", cancellationToken))
        {
            throw new InvalidBackupException("Expected a backup of one account, received a file with the data of several");
        }
        var versions = await SqliteCommands.QueryAsync(
            source, "PRAGMA user_version", reader => reader.GetInt64(0), cancellationToken);
        return versions[0];
    }

    // A file from before accounts or later migrations lacks tables and columns; the old steps add them.
    private static async Task UpgradeAsync(string path, CancellationToken cancellationToken)
    {
        await using var connection = await OpenNewDatabaseAsync(path, cancellationToken);
        await SqliteLegacySchema.EnsureCreatedAsync(connection, cancellationToken);
    }

    // One transaction: either the user's rows are all replaced or none is.
    private async Task ReplaceRowsAsync(string path, string userId, CancellationToken cancellationToken)
    {
        await using var destination = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            destination, $"ATTACH DATABASE $path AS {BackupSchema}", cancellationToken, ("$path", path));
        await using (var transaction = destination.BeginTransaction())
        {
            await SqliteUserRows.DeleteAllAsync(destination, userId, cancellationToken);
            var owner = await BackupOwnerAsync(destination, cancellationToken);
            await SqliteUserRows.CopyAllAsync(destination, BackupSchema, owner, userId, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
    }

    // The file holds one owner (checked before), or none when it predates accounts: then every row is read.
    private static async Task<string?> BackupOwnerAsync(SqliteConnection destination, CancellationToken cancellationToken)
    {
        if (!await SqliteUserRows.ExistsAsync(destination, BackupSchema, "users", cancellationToken)) return null;
        var owners = await SqliteCommands.QueryAsync(
            destination,
            $"SELECT id FROM {BackupSchema}.users LIMIT 1",
            reader => reader.GetString(0),
            cancellationToken);
        return owners.FirstOrDefault();
    }

    private static async Task SaveUploadAsync(Stream backup, string path, CancellationToken cancellationToken)
    {
        await using var file = new FileStream(
            path, FileMode.CreateNew, FileAccess.Write, FileShare.None, CopyBufferBytes, FileOptions.Asynchronous);
        await backup.CopyToAsync(file, cancellationToken);
    }

    private static FileStream OpenAndDeleteOnClose(string path) =>
        new(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, CopyBufferBytes,
            FileOptions.Asynchronous | FileOptions.DeleteOnClose);

    private static string TemporaryPath() =>
        Path.Combine(Path.GetTempPath(), $"orbit-backup-{Guid.NewGuid():N}.db");
}
