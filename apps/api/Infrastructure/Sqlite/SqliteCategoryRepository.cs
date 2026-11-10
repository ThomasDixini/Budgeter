using Orbit.Api.Application.Categories;
using Orbit.Api.Domain.Categories;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Categories stored in the <c>categories</c> table.</summary>
public sealed class SqliteCategoryRepository(SqliteConnectionFactory connections) : ICategoryRepository
{
    private const string SelectColumns = "SELECT id, name, color FROM categories WHERE user_id = $user";

    public async Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        return await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} ORDER BY rowid", ToCategory, cancellationToken, ("$user", connections.UserId));
    }

    public async Task<Category?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} AND id = $id", ToCategory, cancellationToken, ("$user", connections.UserId), ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task<bool> AddAsync(Category category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var inserted = await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "INSERT INTO categories (user_id, id, name, color) VALUES ($user, $id, $name, $color) ON CONFLICT (user_id, id) DO NOTHING",
            cancellationToken,
            ("$user", connections.UserId), ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
        return inserted > 0;
    }

    public async Task UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        await SqliteCommands.ExecuteAsync(
            connection,
            "UPDATE categories SET name = $name, color = $color WHERE user_id = $user AND id = $id",
            cancellationToken,
            ("$user", connections.UserId), ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => DeleteAllOfAsync(lease.Connection, connections.UserId, id, cancellationToken), cancellationToken);
    }

    // Goals go first (their progress cascades); blocks and tasks only lose the reference.
    private static async Task DeleteAllOfAsync(
        SqliteConnection connection, string userId, string id, CancellationToken cancellationToken)
    {
        foreach (var sql in DeleteStatements)
        {
            await SqliteCommands.ExecuteAsync(connection, sql, cancellationToken, ("$user", userId), ("$id", id));
        }
    }

    private static readonly string[] DeleteStatements =
    [
        "DELETE FROM goals WHERE user_id = $user AND category_id = $id",
        "UPDATE routine_blocks SET category_id = NULL WHERE user_id = $user AND category_id = $id",
        "UPDATE tasks SET category_id = NULL WHERE user_id = $user AND category_id = $id",
        "DELETE FROM categories WHERE user_id = $user AND id = $id",
    ];

    private static Category ToCategory(SqliteDataReader reader)
    {
        return Category.Restore(reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }
}
