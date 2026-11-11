using System.Globalization;
using Orbit.Api.Application.Routines;
using Orbit.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

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
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        var blocks = await SqliteCommands.QueryAsync(
            connection,
            "SELECT routine_id, id, name, start_time, end_time, category_id FROM routine_blocks WHERE user_id = $user ORDER BY routine_id, position",
            ToBlockRow,
            cancellationToken,
            ("$user", connections.UserId));
        var blocksByRoutine = blocks.ToLookup(row => row.RoutineId, row => row.Block);
        return await SqliteCommands.QueryAsync(
            connection,
            "SELECT id, name, days, start_time, end_time FROM routines WHERE user_id = $user ORDER BY rowid",
            reader => ToRoutine(reader, blocksByRoutine),
            cancellationToken,
            ("$user", connections.UserId));
    }

    public async Task<Routine?> FindAsync(string routineId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var blocks = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT routine_id, id, name, start_time, end_time, category_id FROM routine_blocks WHERE user_id = $user AND routine_id = $id ORDER BY position",
            ToBlockRow,
            cancellationToken,
            ("$user", connections.UserId), ("$id", routineId));
        var blocksByRoutine = blocks.ToLookup(row => row.RoutineId, row => row.Block);
        var routines = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT id, name, days, start_time, end_time FROM routines WHERE user_id = $user AND id = $id",
            reader => ToRoutine(reader, blocksByRoutine),
            cancellationToken,
            ("$user", connections.UserId), ("$id", routineId));
        return routines.Count == 0 ? null : routines[0];
    }

    public async Task SaveAsync(Routine routine, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => WriteAsync(lease.Connection, connections.UserId, routine, cancellationToken), cancellationToken);
    }

    public async Task DeleteAsync(string routineId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var connection = lease.Connection;
        // Blocks go with it through ON DELETE CASCADE (foreign keys are enforced per connection).
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM routines WHERE user_id = $user AND id = $id", cancellationToken,
            ("$user", connections.UserId), ("$id", routineId));
    }

    /// <summary>
    /// Upserts the routine row (keeping its position in the list) and rewrites its blocks.
    /// Runs inside the caller's transaction, if any.
    /// </summary>
    /// <example><code>await SqliteRoutineRepository.WriteAsync(connection, userId, routine, ct);</code></example>
    internal static async Task WriteAsync(
        SqliteConnection connection, string userId, Routine routine, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routines (user_id, id, name, days, start_time, end_time)
            VALUES ($user, $id, $name, $days, $start, $end)
            ON CONFLICT (user_id, id) DO UPDATE SET
                name = excluded.name, days = excluded.days, start_time = excluded.start_time, end_time = excluded.end_time
            """,
            cancellationToken,
            ("$user", userId), ("$id", routine.Id), ("$name", routine.Name), ("$days", string.Join(DaySeparator, routine.Days)),
            ("$start", routine.Start), ("$end", routine.End));
        await SqliteCommands.ExecuteAsync(
            connection, "DELETE FROM routine_blocks WHERE user_id = $user AND routine_id = $id", cancellationToken,
            ("$user", userId), ("$id", routine.Id));
        for (var position = 0; position < routine.Blocks.Count; position++)
        {
            await InsertBlockAsync(connection, userId, routine.Id, position, routine.Blocks[position], cancellationToken);
        }
    }

    private static Task InsertBlockAsync(
        SqliteConnection connection, string userId, string routineId, int position, RoutineBlock block,
        CancellationToken cancellationToken)
    {
        return SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routine_blocks (user_id, routine_id, id, position, name, start_time, end_time, category_id)
            VALUES ($user, $routineId, $id, $position, $name, $start, $end, $categoryId)
            """,
            cancellationToken,
            ("$user", userId), ("$routineId", routineId), ("$id", block.Id), ("$position", position), ("$name", block.Name),
            ("$start", block.Start), ("$end", block.End), ("$categoryId", block.CategoryId));
    }

    private static BlockRow ToBlockRow(SqliteDataReader reader)
    {
        var block = RoutineBlock.Restore(
            reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetString(5));
        return new BlockRow(reader.GetString(0), block);
    }

    private static Routine ToRoutine(SqliteDataReader reader, ILookup<string, RoutineBlock> blocksByRoutine)
    {
        var id = reader.GetString(0);
        return Routine.Restore(
            id, reader.GetString(1), ParseDays(reader.GetString(2)), reader.GetString(3), reader.GetString(4),
            blocksByRoutine[id]);
    }

    private static IEnumerable<int> ParseDays(string days)
    {
        return days.Split(DaySeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(day => int.Parse(day, CultureInfo.InvariantCulture));
    }
}
