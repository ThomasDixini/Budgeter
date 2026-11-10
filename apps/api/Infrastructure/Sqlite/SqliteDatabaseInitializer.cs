namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Prepares the database before the API starts serving requests. Starter records are not seeded here any
/// more: they belong to a user, so they are stored when the account is created.
/// </summary>
internal sealed class SqliteDatabaseInitializer(
    SqliteConnectionFactory connections,
    ILogger<SqliteDatabaseInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteSchema.EnsureCreatedAsync(connection, cancellationToken);
        logger.LogInformation("SQLite database ready at {DataSource}", connection.DataSource);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
