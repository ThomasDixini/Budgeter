using System.Globalization;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Outcomes stored in <c>block_outcomes</c>. Rows point at the routine only, not at its block rows,
/// because saving a routine rewrites those rows and would otherwise wipe the history.
/// </summary>
public sealed class SqliteBlockOutcomeRepository(SqliteConnectionFactory connections) : IBlockOutcomeRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<IReadOnlyList<BlockOutcome>> ListAsync(DateOnly date, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            connection,
            "SELECT routine_id, block_id, date, kind, at FROM block_outcomes WHERE date = $date ORDER BY rowid",
            ToOutcome,
            cancellationToken,
            ("$date", ToText(date)));
    }

    public async Task SaveAsync(BlockOutcome outcome, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO block_outcomes (routine_id, block_id, date, kind, at) VALUES ($routineId, $blockId, $date, $kind, $at)
            ON CONFLICT (routine_id, block_id, date) DO UPDATE SET kind = excluded.kind, at = excluded.at
            """,
            cancellationToken,
            ("$routineId", outcome.RoutineId), ("$blockId", outcome.BlockId), ("$date", ToText(outcome.Date)),
            ("$kind", outcome.Kind.ToString().ToLowerInvariant()), ("$at", outcome.At));
    }

    private static BlockOutcome ToOutcome(SqliteDataReader reader)
    {
        return BlockOutcome.Create(
            reader.GetString(0),
            reader.GetString(1),
            DateOnly.ParseExact(reader.GetString(2), DateFormat, CultureInfo.InvariantCulture),
            Enum.Parse<BlockOutcomeKind>(reader.GetString(3), ignoreCase: true),
            reader.GetString(4));
    }

    private static string ToText(DateOnly date) => date.ToString(DateFormat, CultureInfo.InvariantCulture);
}
