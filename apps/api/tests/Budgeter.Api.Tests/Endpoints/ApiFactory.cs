using Budgeter.Api.Infrastructure.Sqlite;
using Budgeter.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Budgeter.Api.Tests.Endpoints;

/// <summary>The real API backed by a throwaway SQLite file without sample data.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly TemporarySqliteDatabase _database = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting($"ConnectionStrings:{SqliteOptions.ConnectionStringName}", _database.ConnectionString);
        builder.UseSetting(SqliteOptions.SeedSampleCategoriesKey, "false");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _database.Dispose();
    }
}
