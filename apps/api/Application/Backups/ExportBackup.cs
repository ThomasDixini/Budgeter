namespace Orbit.Api.Application.Backups;

/// <summary>Takes a copy of all the data, of every module, to keep somewhere safe.</summary>
public sealed class ExportBackup(IDatabaseBackup backup, TimeProvider clock)
{
    /// <summary>
    /// Snapshots the database and names the file after the local time it was taken.
    /// </summary>
    /// <example><code>await using var file = (await exportBackup.ExecuteAsync(ct)).Content;</code></example>
    public async Task<BackupFile> ExecuteAsync(CancellationToken cancellationToken)
    {
        var takenAt = clock.GetLocalNow();
        var snapshot = await backup.OpenSnapshotAsync(cancellationToken);
        return new BackupFile(BackupFile.NameFor(takenAt), snapshot);
    }
}
