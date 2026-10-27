using System.Globalization;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Routines stored in the <c>routines</c> table (weekdays kept as "0,1,2") and their blocks in
/// <c>routine_blocks</c>, ordered by <c>position</c>.
/// </summary>
public sealed class SqliteRoutineRepository(SqliteConnectionFactory connections) : IRoutineRepository
{
    private const char DaySeparator = ',';

    private sealed record BlockRow(string RoutineId, RoutineBlock Block);

    public async Task<IReadOnlyList<Routine>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        var blocks = await SqliteCommands.QueryAsync(
            connection,
            "SELECT routine_id, id, name, start_time, end_time, category_id FROM routine_blocks ORDER BY routine_id, position",
            ToBlockRow,
            cancellationToken);
        var blocksByRoutine = blocks.ToLookup(row => row.RoutineId, row => row.Block);
        return await SqliteCommands.QueryAsync(
            connection,
            "SELECT id, name, days, start_time, end_time FROM routines ORDER BY rowid",
            reader => ToRoutine(reader, blocksByRoutine),
            cancellationToken);
    }

    public async Task SaveAsync(Routine routine, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();
        await WriteAsync(connection, routine, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Upserts the routine row (keeping its position in the list) and rewrites its blocks.
    /// Runs inside the caller's transaction, if any.
    /// </summary>
    /// <example><code>await SqliteRoutineRepository.WriteAsync(connection, routine, ct);</code></example>
    internal static async Task WriteAsync(SqliteConnection connection, Routine routine, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routines (id, name, days, start_time, end_time) VALUES ($id, $name, $days, $start, $end)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name, days = excluded.days, start_time = excluded.start_time, end_time = excluded.end_time
            """,
            cancellationToken,
            ("$id", routine.Id), ("$name", routine.Name), ("$days", string.Join(DaySeparator, routine.Days)),
            ("$start", routine.Start), ("$end", routine.End));
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM routine_blocks WHERE routine_id = $id", cancellationToken, ("$id", routine.Id));
        for (var position = 0; position < routine.Blocks.Count; position++)
        {
            await InsertBlockAsync(connection, routine.Id, position, routine.Blocks[position], cancellationToken);
        }
    }

    private static Task InsertBlockAsync(
        SqliteConnection connection, string routineId, int position, RoutineBlock block, CancellationToken cancellationToken)
    {
        return SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routine_blocks (routine_id, id, position, name, start_time, end_time, category_id)
            VALUES ($routineId, $id, $position, $name, $start, $end, $categoryId)
            """,
            cancellationToken,
            ("$routineId", routineId), ("$id", block.Id), ("$position", position), ("$name", block.Name),
            ("$start", block.Start), ("$end", block.End), ("$categoryId", block.CategoryId));
    }

    private static BlockRow ToBlockRow(SqliteDataReader reader)
    {
        var block = RoutineBlock.Create(
            reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5));
        return new BlockRow(reader.GetString(0), block);
    }

    private static Routine ToRoutine(SqliteDataReader reader, ILookup<string, RoutineBlock> blocksByRoutine)
    {
        var id = reader.GetString(0);
        return Routine.Create(
            id, reader.GetString(1), ParseDays(reader.GetString(2)), reader.GetString(3), reader.GetString(4),
            blocksByRoutine[id]);
    }

    private static IEnumerable<int> ParseDays(string days)
    {
        return days.Split(DaySeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(day => int.Parse(day, CultureInfo.InvariantCulture));
    }
}
