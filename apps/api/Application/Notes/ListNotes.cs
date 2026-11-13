using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Application.Notes;

/// <summary>Lists every note, most recently updated first.</summary>
public sealed class ListNotes(INoteRepository notes)
{
    /// <summary>
    /// Returns all notes in the order the repository gives them.
    /// </summary>
    /// <example><code>var all = await listNotes.ExecuteAsync(ct);</code></example>
    public Task<IReadOnlyList<Note>> ExecuteAsync(CancellationToken cancellationToken)
    {
        return notes.ListAsync(cancellationToken);
    }
}
