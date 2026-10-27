namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Prepares the database before the API starts serving requests.</summary>
internal sealed class SqliteDatabaseInitializer(
    SqliteConnectionFactory connections,
    SqliteOptions options,
    ILogger<SqliteDatabaseInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteSchema.EnsureCreatedAsync(connection, cancellationToken);
        if (options.SeedSampleCategories) await SampleCategorySeed.ApplyAsync(connection, cancellationToken);
        logger.LogInformation(
            "SQLite database ready at {DataSource} (sample categories seeded: {Seeded})",
            connection.DataSource,
            options.SeedSampleCategories);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
