using System.Globalization;
using Microsoft.Data.Sqlite;
using Orbit.Api.Application.Notes;
using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Infrastructure.Sqlite;

/// <summary>
/// Notes stored in the <c>notes</c> table. Kind and status are kept as enum names and timestamps as UTC
/// round-trip text, so text order equals time order.
/// </summary>
public sealed class SqliteNoteRepository(SqliteConnectionFactory connections) : INoteRepository
{
    private const string Columns = "id, kind, title, body, status, created_at, updated_at";

    public async Task<Note?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection, $"SELECT {Columns} FROM notes WHERE user_id = $user AND id = $id", ToNote, cancellationToken,
            ("$user", connections.UserId), ("$id", id));
        return found.SingleOrDefault();
    }

    public async Task<IReadOnlyList<Note>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection, $"SELECT {Columns} FROM notes WHERE user_id = $user ORDER BY updated_at DESC, id", ToNote,
            cancellationToken, ("$user", connections.UserId));
    }

    public async Task SaveAsync(Note note, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // created_at is left out of the update so an edit never moves the creation time.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO notes (user_id, id, kind, title, body, status, created_at, updated_at)
            VALUES ($user, $id, $kind, $title, $body, $status, $createdAt, $updatedAt)
            ON CONFLICT (user_id, id) DO UPDATE SET
                kind = excluded.kind, title = excluded.title, body = excluded.body,
                status = excluded.status, updated_at = excluded.updated_at
            """,
            cancellationToken,
            ("$user", connections.UserId), ("$id", note.Id), ("$kind", note.Kind.ToString()),
            ("$title", note.Title), ("$body", note.Body), ("$status", note.Status.ToString()),
            ("$createdAt", ToText(note.CreatedAt)), ("$updatedAt", ToText(note.UpdatedAt)));
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            "DELETE FROM notes WHERE user_id = $user AND id = $id",
            cancellationToken,
            ("$user", connections.UserId), ("$id", id));
    }

    private static Note ToNote(SqliteDataReader reader) =>
        Note.Restore(
            reader.GetString(0), ToEnum<NoteKind>(reader.GetString(1), "kind"), reader.GetString(2),
            reader.GetString(3), ToEnum<NoteStatus>(reader.GetString(4), "status"),
            ToTime(reader.GetString(5)), ToTime(reader.GetString(6)));

    private static TEnum ToEnum<TEnum>(string text, string column) where TEnum : struct, Enum
    {
        if (Enum.IsDefined(typeof(TEnum), text)) return Enum.Parse<TEnum>(text);
        throw new InvalidOperationException(
            $"Expected the note {column} to be one of {string.Join(", ", Enum.GetNames<TEnum>())}, received '{text}'");
    }

    private static string ToText(DateTimeOffset value) =>
        value.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);

    private static DateTimeOffset ToTime(string text) =>
        DateTimeOffset.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
}
