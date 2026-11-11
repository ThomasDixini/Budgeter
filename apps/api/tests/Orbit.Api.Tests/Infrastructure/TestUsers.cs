using Microsoft.Data.Sqlite;
using Orbit.Api.Application;
using Orbit.Api.Infrastructure.Sqlite;

namespace Orbit.Api.Tests.Infrastructure;

/// <summary>The signed-in user of a test: a fixed id, so specs can also act as someone else.</summary>
internal sealed class FixedCurrentUser(string id = TestUsers.DefaultId) : ICurrentUser
{
    public string Id => id;
}

/// <summary>Helpers to give specs of the SQLite adapters a user to own their records.</summary>
internal static class TestUsers
{
    public const string DefaultId = "test-user";
    public const string OtherId = "other-user";

    /// <summary>A factory whose repositories act for <paramref name="userId"/>.</summary>
    /// <example><code>var connections = TestUsers.FactoryFor(database, TestUsers.OtherId);</code></example>
    public static SqliteConnectionFactory FactoryFor(TemporarySqliteDatabase database, string userId = DefaultId) =>
        new(database.ConnectionString, new FixedCurrentUser(userId));

    /// <summary>
    /// Creates the schema and the given users, so records can be stored for them. Call it once from the
    /// spec's setup, after creating the factory.
    /// </summary>
    /// <example><code>await TestUsers.CreateSchemaAsync(_connections);</code></example>
    public static async Task CreateSchemaAsync(SqliteConnectionFactory connections, params string[] userIds)
    {
        await using var connection = await connections.OpenAsync(CancellationToken.None);
        await SqliteSchema.EnsureCreatedAsync(connection, CancellationToken.None);
        foreach (var id in userIds.Length == 0 ? [DefaultId] : userIds) await InsertAsync(connection, id);
    }

    /// <summary>Stores a user row with the given id (and an e-mail derived from it).</summary>
    /// <example><code>await TestUsers.InsertAsync(connection, "ana");</code></example>
    public static Task<int> InsertAsync(SqliteConnection connection, string id) =>
        SqliteCommands.ExecuteAsync(
            connection,
            "INSERT OR IGNORE INTO users (id, email, name, password_hash) VALUES ($id, $email, $id, 'x')",
            CancellationToken.None,
            ("$id", id), ("$email", $"{id}@test.local"));
}

/// <summary>A signed-in user whose id a spec can change, for specs where the id is only known later.</summary>
internal sealed class MovableCurrentUser(string id = TestUsers.DefaultId) : ICurrentUser
{
    public string Id { get; set; } = id;
}
