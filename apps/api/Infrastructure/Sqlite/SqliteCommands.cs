using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>Runs parameterized SQL and maps rows, so repositories only hold their queries.</summary>
internal static class SqliteCommands
{
    /// <summary>
    /// Runs a statement that returns no rows.
    /// </summary>
    /// <example><code>await SqliteCommands.ExecuteAsync(connection, "DELETE FROM goals WHERE id = $id", ct, ("$id", "g1"));</code></example>
    public static async Task ExecuteAsync(
        SqliteConnection connection,
        string sql,
        CancellationToken cancellationToken,
        params (string Name, object? Value)[] parameters)
    {
        await using var command = Create(connection, sql, parameters);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <summary>
    /// Runs a query and maps every row.
    /// </summary>
    /// <example><code>var names = await SqliteCommands.QueryAsync(connection, "SELECT name FROM categories", reader => reader.GetString(0), ct);</code></example>
    public static async Task<IReadOnlyList<TRow>> QueryAsync<TRow>(
        SqliteConnection connection,
        string sql,
        Func<SqliteDataReader, TRow> mapRow,
        CancellationToken cancellationToken,
        params (string Name, object? Value)[] parameters)
    {
        await using var command = Create(connection, sql, parameters);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<TRow>();
        while (await reader.ReadAsync(cancellationToken)) rows.Add(mapRow(reader));
        return rows;
    }

    private static SqliteCommand Create(
        SqliteConnection connection, string sql, (string Name, object? Value)[] parameters)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return command;
    }
}
