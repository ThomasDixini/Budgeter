using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Users;
using Orbit.Api.Domain.Users;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Accounts stored in the <c>users</c> table.</summary>
public sealed class SqliteUserRepository(SqliteConnectionFactory connections) : IUserRepository
{
    public async Task<StoredUser?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT id, email, name, password_hash FROM users WHERE email = $email",
            ToStoredUser,
            cancellationToken,
            ("$email", email));
        return rows.FirstOrDefault();
    }

    public async Task<User?> AddAsync(User user, string passwordHash, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        User? stored = null;
        await lease.RunInTransactionAsync(
            async () => stored = await InsertOrClaimAsync(lease.Connection, user, passwordHash, cancellationToken),
            cancellationToken);
        return stored;
    }

    // The first account takes over the placeholder owner of the data a single-user install already held.
    private static async Task<User?> InsertOrClaimAsync(
        SqliteConnection connection, User user, string passwordHash, CancellationToken cancellationToken)
    {
        var claimed = await ClaimPlaceholderAsync(connection, user, passwordHash, cancellationToken);
        if (claimed is not null) return claimed;
        var inserted = await SqliteCommands.ExecuteAsync(
            connection,
            "INSERT INTO users (id, email, name, password_hash) VALUES ($id, $email, $name, $hash) ON CONFLICT (email) DO NOTHING",
            cancellationToken,
            ("$id", user.Id), ("$email", user.Email), ("$name", user.Name), ("$hash", passwordHash));
        return inserted > 0 ? user : null;
    }

    private static async Task<User?> ClaimPlaceholderAsync(
        SqliteConnection connection, User user, string passwordHash, CancellationToken cancellationToken)
    {
        if (await EmailIsTakenAsync(connection, user.Email, cancellationToken)) return null;
        var ids = await SqliteCommands.QueryAsync(
            connection,
            """
            UPDATE users SET email = $email, name = $name, password_hash = $hash
            WHERE email = $placeholder AND password_hash = ''
            RETURNING id
            """,
            reader => reader.GetString(0),
            cancellationToken,
            ("$email", user.Email), ("$name", user.Name), ("$hash", passwordHash),
            ("$placeholder", SqliteMultiUserMigration.PlaceholderEmail));
        return ids.Count == 0 ? null : User.Restore(ids[0], user.Email, user.Name);
    }

    private static async Task<bool> EmailIsTakenAsync(
        SqliteConnection connection, string email, CancellationToken cancellationToken)
    {
        var counts = await SqliteCommands.QueryAsync(
            connection,
            "SELECT COUNT(*) FROM users WHERE email = $email",
            reader => reader.GetInt64(0),
            cancellationToken,
            ("$email", email));
        return counts[0] > 0;
    }

    private static StoredUser ToStoredUser(SqliteDataReader reader) =>
        new(User.Restore(reader.GetString(0), reader.GetString(1), reader.GetString(2)), reader.GetString(3));
}
