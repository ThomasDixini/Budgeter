using Orbit.Api.Application.Categories;
using Orbit.Api.Domain.Categories;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Categories stored in the <c>categories</c> table.</summary>
public sealed class SqliteCategoryRepository(SqliteConnectionFactory connections) : ICategoryRepository
{
    private const string SelectColumns = "SELECT id, name, color FROM categories";

    public async Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        return await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} ORDER BY rowid", ToCategory, cancellationToken);
    }

    public async Task<Category?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} WHERE id = $id", ToCategory, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task<bool> AddAsync(Category category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var inserted = await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "INSERT INTO categories (id, name, color) VALUES ($id, $name, $color) ON CONFLICT (id) DO NOTHING",
            cancellationToken,
            ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
        return inserted > 0;
    }

    public async Task UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        await SqliteCommands.ExecuteAsync(
            connection,
            "UPDATE categories SET name = $name, color = $color WHERE id = $id",
            cancellationToken,
            ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => DeleteAllOfAsync(lease.Connection, id, cancellationToken), cancellationToken);
    }

    // Goals go first (their progress cascades); blocks and tasks only lose the reference.
    private static async Task DeleteAllOfAsync(SqliteConnection connection, string id, CancellationToken cancellationToken)
    {
        foreach (var sql in DeleteStatements)
        {
            await SqliteCommands.ExecuteAsync(connection, sql, cancellationToken, ("$id", id));
        }
    }

    private static readonly string[] DeleteStatements =
    [
        "DELETE FROM goals WHERE category_id = $id",
        "UPDATE routine_blocks SET category_id = NULL WHERE category_id = $id",
        "UPDATE tasks SET category_id = NULL WHERE category_id = $id",
        "DELETE FROM categories WHERE id = $id",
    ];

    private static Category ToCategory(SqliteDataReader reader)
    {
        return Category.Restore(reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }
}
