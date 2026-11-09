namespace Orbit.Api.Application.Backups;

/// <summary>Puts back all the data from a backup, replacing what is stored now.</summary>
public sealed class RestoreBackup(IDatabaseBackup backup)
{
    /// <summary>
    /// Replaces every module's records with the backup's; a file that is not a backup changes nothing.
    /// </summary>
    /// <example><code>await restoreBackup.ExecuteAsync(request.Body, ct);</code></example>
    public Task ExecuteAsync(Stream backupFile, CancellationToken cancellationToken) =>
        backup.RestoreAsync(backupFile, cancellationToken);
}
