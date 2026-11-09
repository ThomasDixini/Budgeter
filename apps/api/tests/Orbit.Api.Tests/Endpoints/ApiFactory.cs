using Orbit.Api.Infrastructure.Cdi;
using Orbit.Api.Infrastructure.Quotes;
using Orbit.Api.Infrastructure.Sqlite;
using Orbit.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Orbit.Api.Tests.Endpoints;

/// <summary>The real API backed by a throwaway SQLite file without sample data.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly TemporarySqliteDatabase _database = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting($"ConnectionStrings:{SqliteOptions.ConnectionStringName}", _database.ConnectionString);
        builder.UseSetting(SqliteOptions.SeedSampleDataKey, "false");
        builder.UseSetting(CdiRegistration.EnabledKey, "false");
        builder.UseSetting(QuotesRegistration.EnabledKey, "false");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _database.Dispose();
    }
}
