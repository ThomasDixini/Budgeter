namespace Orbit.Api.Application.Backups;

/// <summary>
/// Port to a copy of the whole database: every module's records (finances, routines, goals and any
/// module added later) travel together, so a restore never mixes data from two points in time.
/// </summary>
public interface IDatabaseBackup
{
    /// <summary>
    /// Takes a consistent copy of the database as it is now; the caller disposes the stream.
    /// </summary>
    /// <example><code>await using var snapshot = await backup.OpenSnapshotAsync(ct);</code></example>
    Task<Stream> OpenSnapshotAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Replaces every record with the backup's, bringing an older backup up to the current schema.
    /// Throws <see cref="InvalidBackupException"/> and changes nothing when the file is not a backup.
    /// </summary>
    /// <example><code>await backup.RestoreAsync(uploadedFile, ct);</code></example>
    Task RestoreAsync(Stream backup, CancellationToken cancellationToken);
}
