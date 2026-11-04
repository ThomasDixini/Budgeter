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
        await FinanceStarterSeed.ApplyOnceAsync(connection, cancellationToken);
        if (options.SeedSampleData) await SampleData.ApplyOnceAsync(connection, cancellationToken);
        logger.LogInformation(
            "SQLite database ready at {DataSource} (sample data seeded: {Seeded})",
            connection.DataSource,
            options.SeedSampleData);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
