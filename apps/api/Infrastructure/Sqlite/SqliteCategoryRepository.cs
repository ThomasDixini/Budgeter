using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Categories stored in the <c>categories</c> table.</summary>
public sealed class SqliteCategoryRepository(SqliteConnectionFactory connections) : ICategoryRepository
{
    private const string SelectColumns = "SELECT id, name, color FROM categories";

    public async Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} ORDER BY rowid", ToCategory, cancellationToken);
    }

    public async Task<Category?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            connection, $"{SelectColumns} WHERE id = $id", ToCategory, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task AddAsync(Category category, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            "INSERT INTO categories (id, name, color) VALUES ($id, $name, $color)",
            cancellationToken,
            ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
    }

    public async Task UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            "UPDATE categories SET name = $name, color = $color WHERE id = $id",
            cancellationToken,
            ("$id", category.Id), ("$name", category.Name), ("$color", category.Color));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        // Goals go first (their progress cascades); blocks and tasks only lose the reference.
        foreach (var sql in DeleteStatements)
        {
            await SqliteCommands.ExecuteAsync(connection, sql, cancellationToken, ("$id", id));
        }
        await transaction.CommitAsync(cancellationToken);
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
        return Category.Create(reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }
}
