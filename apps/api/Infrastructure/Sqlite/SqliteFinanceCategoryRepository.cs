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
            lease.Connection, $"{SelectColumns} WHERE user_id = $user ORDER BY name COLLATE NOCASE", ToCategory, cancellationToken,
            ("$user", connections.UserId));
    }

    public async Task<FinanceCategory?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var rows = await SqliteCommands.QueryAsync(
            lease.Connection, $"{SelectColumns} WHERE user_id = $user AND id = $id", ToCategory, cancellationToken,
            ("$user", connections.UserId), ("$id", id));
        return rows.FirstOrDefault();
    }

    public async Task SaveAsync(FinanceCategory category, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO finance_categories (user_id, id, name) VALUES ($user, $id, $name)
            ON CONFLICT (user_id, id) DO UPDATE SET name = excluded.name
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", category.Id), ("$name", category.Name));
    }

    public async Task DeleteAsync(string categoryId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "DELETE FROM finance_categories WHERE user_id = $user AND id = $id",
            cancellationToken,
            ("$user", connections.UserId), ("$id", categoryId));
    }

    private static FinanceCategory ToCategory(SqliteDataReader reader) =>
        FinanceCategory.Restore(reader.GetString(0), reader.GetString(1));
}
