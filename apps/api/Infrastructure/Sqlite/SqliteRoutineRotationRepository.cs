using System.Globalization;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain.Routines;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

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
            lease.Connection, "SELECT starts_on FROM routine_rotation", reader => ParseDate(reader.GetString(0)), cancellationToken);
        if (starts.Count == 0) return RoutineRotation.Empty;
        var steps = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT routine_id, weeks FROM routine_rotation_steps ORDER BY position",
            reader => RotationStep.Restore(reader.GetString(0), reader.GetInt32(1)),
            cancellationToken);
        return RoutineRotation.Restore(starts[0], steps);
    }

    public async Task ReplaceAsync(RoutineRotation rotation, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await lease.RunInTransactionAsync(() => WriteAsync(lease.Connection, rotation, cancellationToken), cancellationToken);
    }

    private static async Task WriteAsync(SqliteConnection connection, RoutineRotation rotation, CancellationToken cancellationToken)
    {
        await SqliteCommands.ExecuteAsync(connection, "DELETE FROM routine_rotation_steps", cancellationToken);
        await SqliteCommands.ExecuteAsync(
            connection,
            """
            INSERT INTO routine_rotation (id, starts_on) VALUES (1, $startsOn)
            ON CONFLICT (id) DO UPDATE SET starts_on = excluded.starts_on
            """,
            cancellationToken,
            ("$startsOn", rotation.StartsOn.ToString(DateFormat, CultureInfo.InvariantCulture)));
        for (var position = 0; position < rotation.Steps.Count; position++)
        {
            var step = rotation.Steps[position];
            await SqliteCommands.ExecuteAsync(
                connection,
                "INSERT INTO routine_rotation_steps (position, routine_id, weeks) VALUES ($position, $routineId, $weeks)",
                cancellationToken,
                ("$position", position), ("$routineId", step.RoutineId), ("$weeks", step.Weeks));
        }
    }

    private static DateOnly ParseDate(string stored) =>
        DateOnly.ParseExact(stored, DateFormat, CultureInfo.InvariantCulture);
}
