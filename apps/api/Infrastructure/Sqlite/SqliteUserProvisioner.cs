using Orbit.Api.Application.Users;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Gives a new account the records every account starts with: the finance categories and accounts, and the
/// sample categories, routines and tasks when the options ask for them.
/// </summary>
public sealed class SqliteUserProvisioner(SqliteConnectionFactory connections, SqliteOptions options) : IUserProvisioner
{
    public async Task ProvisionAsync(string userId, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await FinanceStarterSeed.ApplyOnceAsync(connection, userId, cancellationToken);
        if (options.SeedSampleData) await SampleData.ApplyOnceAsync(connection, userId, cancellationToken);
    }
}
