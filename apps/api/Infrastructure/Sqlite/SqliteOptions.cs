namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Settings of the local SQLite persistence.</summary>
/// <param name="ConnectionString">From <c>ConnectionStrings:Budgeter</c>, e.g. <c>Data Source=budgeter.db</c>.</param>
/// <param name="SeedSampleCategories">From <c>Persistence:SeedSampleCategories</c>.</param>
public sealed record SqliteOptions(string ConnectionString, bool SeedSampleCategories)
{
    public const string ConnectionStringName = "Budgeter";
    public const string SeedSampleCategoriesKey = "Persistence:SeedSampleCategories";

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
                $"Expected ConnectionStrings:{ConnectionStringName} shaped like \"Data Source=budgeter.db\", received none");
        }
        return new SqliteOptions(connectionString, configuration.GetValue<bool>(SeedSampleCategoriesKey));
    }
}
