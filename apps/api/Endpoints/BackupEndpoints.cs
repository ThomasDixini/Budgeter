using Orbit.Api.Application.Backups;
using Microsoft.AspNetCore.Mvc;

namespace Orbit.Api.Endpoints;

/// <summary>HTTP routes to download a copy of all the data and to put one back.</summary>
public static class BackupEndpoints
{
    /// <summary>
    /// Largest backup accepted for restore. A personal database is a few MB; the cap leaves room to grow
    /// while keeping a stray upload from filling the disk. It overrides the API-wide 256 KB body cap.
    /// </summary>
    public const long MaxBackupBytes = 64L * 1024 * 1024;

    private const string SqliteContentType = "application/vnd.sqlite3";

    /// <summary>
    /// Maps <c>GET /backup</c> (downloads the SQLite file) and <c>POST /backup/restore</c> (replaces all
    /// the data with the file sent as the raw body).
    /// </summary>
    /// <example><code>app.MapBackupEndpoints();</code></example>
    public static IEndpointRouteBuilder MapBackupEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/backup", DownloadAsync);
        routes.MapPost("/backup/restore", RestoreAsync).WithMetadata(new RequestSizeLimitAttribute(MaxBackupBytes));
        return routes;
    }

    private static async Task<IResult> DownloadAsync(ExportBackup exportBackup, CancellationToken cancellationToken)
    {
        var file = await exportBackup.ExecuteAsync(cancellationToken);
        return Results.File(file.Content, SqliteContentType, file.FileName);
    }

    private static async Task<IResult> RestoreAsync(
        HttpRequest request, RestoreBackup restoreBackup, CancellationToken cancellationToken)
    {
        await restoreBackup.ExecuteAsync(request.Body, cancellationToken);
        return Results.NoContent();
    }
}
