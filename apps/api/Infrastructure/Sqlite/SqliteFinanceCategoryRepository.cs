using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

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

    private static FinanceCategory ToCategory(SqliteDataReader reader) =>
        FinanceCategory.Restore(reader.GetString(0), reader.GetString(1));
}
