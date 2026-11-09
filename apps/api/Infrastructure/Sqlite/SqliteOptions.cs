namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Settings of the local SQLite persistence.</summary>
/// <param name="ConnectionString">From <c>ConnectionStrings:Orbit</c>, e.g. <c>Data Source=orbit.db</c>.</param>
/// <param name="SeedSampleData">From <c>Persistence:SeedSampleData</c>.</param>
public sealed record SqliteOptions(string ConnectionString, bool SeedSampleData)
{
    public const string ConnectionStringName = "Orbit";
    public const string SeedSampleDataKey = "Persistence:SeedSampleData";

    /// <summary>
    /// Reads the options, failing fast when the connection string is missing.
    /// </summary>
    /// <example><code>var options = SqliteOptions.FromConfiguration(builder.Configuration);</code></example>
    public static SqliteOptions FromConfiguration(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Expected ConnectionStrings:{ConnectionStringName} shaped like \"Data Source=orbit.db\", received none");
        }
        return new SqliteOptions(connectionString, configuration.GetValue<bool>(SeedSampleDataKey));
    }
}
