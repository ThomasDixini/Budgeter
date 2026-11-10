using Microsoft.Data.Sqlite;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>A SQLite file in the temp folder, deleted when the test ends.</summary>
internal sealed class TemporarySqliteDatabase : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), $"orbit-test-{Guid.NewGuid():N}.db");

    public string ConnectionString => $"Data Source={_path}";

    public void Dispose()
    {
        // Pooled connections keep the file locked on Windows until the pool is cleared.
        SqliteConnection.ClearAllPools();
        File.Delete(_path);
    }
}
