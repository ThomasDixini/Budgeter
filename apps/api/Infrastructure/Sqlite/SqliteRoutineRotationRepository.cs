using System.Globalization;
using Orbit.Api.Application.Routines;
using Orbit.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// The routine rotation stored in <c>routine_rotation</c> (its start, one row) and its steps in
/// <c>routine_rotation_steps</c>, ordered by <c>position</c>. Deleting a routine drops its steps
/// through ON DELETE CASCADE, so the rotation never points at a routine that is gone.
/// </summary>
public sealed class SqliteRoutineRotationRepository(SqliteConnectionFactory connections) : IRoutineRotationRepository
{
    private const string DateFormat = "yyyy-MM-dd";

    public async Task<RoutineRotation> GetAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var starts = await SqliteCommands.QueryAsync(
            lease.Connection, "SELECT starts_on FROM routine_rotation WHERE user_id = $user",
            reader => ParseDate(reader.GetString(0)), cancellationToken, ("$user", connections.UserId));
        if (starts.Count == 0) return RoutineRotation.Empty;
        var steps = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT routine_id, weeks FROM routine_rotation_steps WHERE user_id = $user ORDER BY position",
            reader => RotationStep.Restore(reader.GetString(0), reader.GetInt32(1)),
            cancellationToken,
            ("$user", connections.UserId));
        return RoutineRotation.Restore(starts[0], steps);
    }

    public async Task ReplaceAsync(RoutineRotation rotation, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => WriteAsync(lease.Connection, connections.UserId, rotation, cancellationToken), cancellationToken);
    }

    private static async Task WriteAsync(
        SqliteConnection connection, string userId, RoutineRotation rotation, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, "DELETE FROM routine_rotation_steps WHERE user_id = $user", cancellationToken,
            ("$user", userId));
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routine_rotation (user_id, starts_on) VALUES ($user, $startsOn)
            ON CONFLICT (user_id) DO UPDATE SET starts_on = excluded.starts_on
            """,
            cancellationToken,
            ("$user", userId), ("$startsOn", rotation.StartsOn.ToString(DateFormat, CultureInfo.InvariantCulture)));
        for (var position = 0; position < rotation.Steps.Count; position++)
        {
            var step = rotation.Steps[position];
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT INTO routine_rotation_steps (user_id, position, routine_id, weeks) " +
                "VALUES ($user, $position, $routineId, $weeks)",
                cancellationToken,
                ("$user", userId), ("$position", position), ("$routineId", step.RoutineId), ("$weeks", step.Weeks));
        }
    }

    private static DateOnly ParseDate(string stored) =>
        DateOnly.ParseExact(stored, DateFormat, CultureInfo.InvariantCulture);
}
