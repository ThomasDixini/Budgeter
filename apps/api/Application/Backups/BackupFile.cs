namespace Budgeter.Api.Application.Backups;

/// <summary>A database copy ready to download, named after the moment it was taken.</summary>
/// <param name="FileName">E.g. <c>budgeter-backup-2026-11-09-153000.db</c>.</param>
/// <param name="Content">The SQLite file; whoever sends it disposes it.</param>
public sealed record BackupFile(string FileName, Stream Content)
{
    /// <summary>
    /// The file name for a copy taken at <paramref name="takenAt"/>, sortable by date.
    /// </summary>
    /// <example><code>BackupFile.NameFor(new DateTimeOffset(2026, 11, 9, 15, 30, 0, TimeSpan.Zero)); // "budgeter-backup-2026-11-09-153000.db"</code></example>
    public static string NameFor(DateTimeOffset takenAt) =>
        $"budgeter-backup-{takenAt:yyyy-MM-dd-HHmmss}.db";
}
