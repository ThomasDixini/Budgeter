using Orbit.Api.Application.Backups;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Opens a file offered for restore once it proves to be an intact Orbit database.</summary>
internal static class SqliteBackupFile
{
    private static readonly byte[] SqliteHeader = "SQLite format 3\0"u8.ToArray();

    /// <summary>
    /// Opens the file read-only, or throws <see cref="InvalidBackupException"/> naming what is wrong.
    /// The caller disposes the connection; it is not pooled, so the file can be deleted right after.
    /// </summary>
    /// <example><code>await using var source = await SqliteBackupFile.OpenValidatedAsync(path, ct);</code></example>
    public static async Task<SqliteConnection> OpenValidatedAsync(string path, CancellationToken cancellationToken)
    {
        await RequireSqliteHeaderAsync(path, cancellationToken);
        var connection = new SqliteConnection(ReadOnlyConnectionString(path));
        try
        {
            await connection.OpenAsync(cancellationToken);
            await RequireOrbitDatabaseAsync(connection, cancellationToken);
            return connection;
        }
        catch (Exception error) when (error is SqliteException or InvalidBackupException)
        {
            await connection.DisposeAsync();
            throw error as InvalidBackupException
                ?? new InvalidBackupException($"Expected a readable Orbit backup, received a damaged SQLite file: {error.Message}");
        }
    }

    private static async Task RequireSqliteHeaderAsync(string path, CancellationToken cancellationToken)
    {
        var header = new byte[SqliteHeader.Length];
        await using var file = File.OpenRead(path);
        var read = await file.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        if (read == header.Length && header.AsSpan().SequenceEqual(SqliteHeader)) return;
        throw new InvalidBackupException(
            $"Expected an Orbit backup (a SQLite .db file), received a {file.Length}-byte file that is not a SQLite database");
    }

    private static async Task RequireOrbitDatabaseAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var applicationId = await PragmaAsync(connection, "application_id", cancellationToken);
        if (applicationId != SqliteSchema.ApplicationId)
        {
            throw new InvalidBackupException(
                $"Expected an Orbit backup (application_id {SqliteSchema.ApplicationId}), received a SQLite database with application_id {applicationId}");
        }
        await RequireKnownVersionAsync(connection, cancellationToken);
        await RequireIntactAsync(connection, cancellationToken);
    }

    // Steps of a newer version are unknown here, so its backup could not be read correctly.
    private static async Task RequireKnownVersionAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var version = await PragmaAsync(connection, "user_version", cancellationToken);
        if (version <= SqliteSchema.CurrentVersion) return;
        throw new InvalidBackupException(
            $"Expected a backup of schema version {SqliteSchema.CurrentVersion} or older, received version {version} from a newer Orbit");
    }

    private static async Task RequireIntactAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        var problems = await SqliteCommands.QueryAsync(
            connection, "PRAGMA integrity_check", reader => reader.GetString(0), cancellationToken);
        if (problems is ["ok"]) return;
        throw new InvalidBackupException(
            $"Expected an intact backup, received a damaged one: {string.Join("; ", problems.Take(3))}");
    }

    private static async Task<long> PragmaAsync(SqliteConnection connection, string pragma, CancellationToken cancellationToken)
    {
        var values = await SqliteCommands.QueryAsync(
            connection, $"PRAGMA {pragma}", reader => reader.GetInt64(0), cancellationToken);
        return values[0];
    }

    private static string ReadOnlyConnectionString(string path) =>
        new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString();
}
