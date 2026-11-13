using Orbit.Api.Domain;
using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Application.Notes;

public sealed record SetNoteStatusCommand(string Id, NoteStatus Status);

/// <summary>Moves a note between open, done and archived.</summary>
public sealed class SetNoteStatus(INoteRepository notes, TimeProvider clock)
{
    /// <summary>
    /// Changes the status of an existing note; an unknown id is a not-found error.
    /// </summary>
    /// <example><code>await setNoteStatus.ExecuteAsync(new SetNoteStatusCommand("n1", NoteStatus.Archived), ct);</code></example>
    public async Task<Note> ExecuteAsync(SetNoteStatusCommand command, CancellationToken cancellationToken)
    {
        var id = EntityId.Require(command.Id, "note id");
        var stored = await notes.FindAsync(id, cancellationToken)
            ?? throw ResourceNotFoundException.For("note", id);
        var note = stored.WithStatus(command.Status, clock.GetUtcNow());
        await notes.SaveAsync(note, cancellationToken);
        return note;
    }
}
