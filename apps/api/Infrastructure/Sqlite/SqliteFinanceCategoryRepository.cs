using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>Finance categories stored in the <c>finance_categories</c> table.</summary>
public sealed class SqliteFinanceCategoryRepository(SqliteConnectionFactory connections) : IFinanceCategoryRepository
{
    private const string SelectColumns = "SELECT id, name FROM finance_categories";

    public async Task<IReadOnlyList<FinanceCategory>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} ORDER BY name COLLATE NOCASE", ToCategory, cancellationToken);
    }

    public async Task<FinanceCategory?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} WHERE id = $id", ToCategory, cancellationToken, ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task SaveAsync(FinanceCategory category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO finance_categories (id, name) VALUES ($id, $name)
            ON CONFLICT (id) DO UPDATE SET name = excluded.name
            """,
            cancellationToken,
            ("$id", category.Id), ("$name", category.Name));
    }

    public async Task DeleteAsync(string categoryId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM finance_categories WHERE id = $id", cancellationToken, ("$id", categoryId));
    }

    private static FinanceCategory ToCategory(SqliteDataReader reader) =>
        FinanceCategory.Restore(reader.GetString(0), reader.GetString(1));
}
