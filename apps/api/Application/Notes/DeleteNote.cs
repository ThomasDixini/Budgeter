using Orbit.Api.Domain;

namespace Orbit.Api.Application.Notes;

/// <summary>Deletes a note; deleting one already gone succeeds, so retries are harmless.</summary>
public sealed class DeleteNote(INoteRepository notes)
{
    /// <summary>
    /// Validates the id and removes the note if it exists.
    /// </summary>
    /// <example><code>await deleteNote.ExecuteAsync("n1", ct);</code></example>
    public Task ExecuteAsync(string noteId, CancellationToken cancellationToken)
    {
        return notes.DeleteAsync(EntityId.Require(noteId, "note id"), cancellationToken);
    }
}
