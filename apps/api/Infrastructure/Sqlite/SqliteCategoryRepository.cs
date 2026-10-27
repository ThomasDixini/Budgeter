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

    private static Category ToCategory(SqliteDataReader reader)
    {
        return Category.Create(reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }
}
