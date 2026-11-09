using Orbit.Api.Application.Backups;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Backs up and restores the SQLite file as a whole, so every table — of any module, today's or one
/// added later — is included without being listed here.
/// </summary>
public sealed class SqliteDatabaseBackup(SqliteConnectionFactory connections) : IDatabaseBackup
{
    private const int CopyBufferBytes = 81920;

    public async Task<Stream> OpenSnapshotAsync(CancellationToken cancellationToken)
    {
        var path = TemporaryPath();
        try
        {
            await WriteSnapshotAsync(path, cancellationToken);
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
            await using var source = await SqliteBackupFile.OpenValidatedAsync(path, cancellationToken);
            await ReplaceDatabaseAsync(source, cancellationToken);
        }
        finally
        {
            File.Delete(path);
        }
    }

    // VACUUM INTO writes a consistent, compacted copy while other requests keep reading and writing.
    private async Task WriteSnapshotAsync(string path, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(connection, "VACUUM INTO $path", cancellationToken, ("$path", path));
    }

    // The online backup API swaps every page in one step, so no request sees half the old data.
    private async Task ReplaceDatabaseAsync(SqliteConnection source, CancellationToken cancellationToken)
    {
        await using var destination = await connections.OpenAsync(cancellationToken);
        source.BackupDatabase(destination);
        // A backup from an older version lacks the tables and columns added since; startup's steps add them.
        await SqliteSchema.EnsureCreatedAsync(destination, cancellationToken);
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
