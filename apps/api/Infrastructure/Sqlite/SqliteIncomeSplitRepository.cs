using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// The income split stored in three tables: the plan's base income (one row), its parts, and the
/// categories each part spends on. A category sits in one part at most, which its primary key enforces.
/// </summary>
public sealed class SqliteIncomeSplitRepository(SqliteConnectionFactory connections) : IIncomeSplitRepository
{
    public async Task<IncomeSplit> GetAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var incomes = await SqliteCommands.QueryAsync(
            lease.Connection, "SELECT base_income_cents FROM income_split", reader => reader.GetInt64(0), cancellationToken);
        if (incomes.Count == 0) return IncomeSplit.Empty;
        return IncomeSplit.Restore(incomes[0], await ReadPartsAsync(lease.Connection, cancellationToken));
    }

    public async Task ReplaceAsync(IncomeSplit plan, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => WriteAsync(lease.Connection, plan, cancellationToken), cancellationToken);
    }

    private static async Task<IReadOnlyList<IncomeSplitPart>> ReadPartsAsync(
        SqliteConnection connection, CancellationToken cancellationToken)
    {
        var categories = (await SqliteCommands.QueryAsync(
                connection,
                "SELECT part_id, category_id FROM income_split_categories ORDER BY position",
                reader => (PartId: reader.GetString(0), CategoryId: reader.GetString(1)),
                cancellationToken))
            .ToLookup(row => row.PartId, row => row.CategoryId);
        return await SqliteCommands.QueryAsync(
            connection,
            "SELECT id, name, percent, color FROM income_split_parts ORDER BY position",
            reader => IncomeSplitPart.Restore(
                reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3),
                categories[reader.GetString(0)].ToList()),
            cancellationToken);
    }

    private static async Task WriteAsync(SqliteConnection connection, IncomeSplit plan, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, "DELETE FROM income_split_parts", cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO income_split (id, base_income_cents) VALUES (1, $income)
            ON CONFLICT (id) DO UPDATE SET base_income_cents = excluded.base_income_cents
            """,
            cancellationToken,
            ("$income", plan.BaseIncomeCents));
        for (var position = 0; position < plan.Parts.Count; position++)
        {
            await InsertPartAsync(connection, plan.Parts[position], position, cancellationToken);
        }
    }

    private static async Task InsertPartAsync(
        SqliteConnection connection, IncomeSplitPart part, int position, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(
            connection,
            "INSERT INTO income_split_parts (id, position, name, percent, color) VALUES ($id, $position, $name, $percent, $color)",
            cancellationToken,
            ("$id", part.Id), ("$position", position), ("$name", part.Name), ("$percent", part.Percent), ("$color", part.Color));
        for (var order = 0; order < part.CategoryIds.Count; order++)
        {
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT INTO income_split_categories (category_id, part_id, position) VALUES ($categoryId, $partId, $position)",
                cancellationToken,
                ("$categoryId", part.CategoryIds[order]), ("$partId", part.Id), ("$position", order));
        }
    }
}
