using Orbit.Api.Domain;
using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Application.Notes;

public sealed record SaveNoteCommand(string Id, NoteKind Kind, string Title, string? Body);

/// <summary>Creates an open note or edits an existing one; saving the same content twice leaves the same content.</summary>
public sealed class SaveNote(INoteRepository notes, TimeProvider clock)
{
    /// <summary>
    /// Creates the note when the id is new, otherwise edits it (keeping its status); a missing body means empty text.
    /// </summary>
    /// <example><code>await saveNote.ExecuteAsync(new SaveNoteCommand("n1", NoteKind.Idea, "Standing desk", null), ct);</code></example>
    public async Task<Note> ExecuteAsync(SaveNoteCommand command, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var stored = await notes.FindAsync(EntityId.Require(command.Id, "note id"), cancellationToken);
        var note = stored is null
            ? Note.Create(command.Id, command.Kind, command.Title, command.Body ?? "", now)
            : stored.Edited(command.Kind, command.Title, command.Body ?? "", now);
        await notes.SaveAsync(note, cancellationToken);
        return note;
    }
}
