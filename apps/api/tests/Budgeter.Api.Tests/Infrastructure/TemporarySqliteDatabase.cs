using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Tests.Infrastructure;

/// <summary>A SQLite file in the temp folder, deleted when the test ends.</summary>
internal sealed class TemporarySqliteDatabase : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), $"budgeter-test-{Guid.NewGuid():N}.db");

    public string ConnectionString => $"Data Source={_path}";

    public void Dispose()
    {
        // Pooled connections keep the file locked on Windows until the pool is cleared.
        SqliteConnection.ClearAllPools();
        File.Delete(_path);
    }
}
