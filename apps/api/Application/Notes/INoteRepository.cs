using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Application.Notes;

/// <summary>Storage port for the user's notes.</summary>
public interface INoteRepository
{
    /// <summary>The note with this id, or null when there is none.</summary>
    Task<Note?> FindAsync(string id, CancellationToken ct);

    /// <summary>Every note, most recently updated first, then by id.</summary>
    Task<IReadOnlyList<Note>> ListAsync(CancellationToken ct);

    /// <summary>Inserts the note or replaces the stored one with the same id.</summary>
    Task SaveAsync(Note note, CancellationToken ct);

    /// <summary>Removes the note; an unknown id is ignored.</summary>
    Task DeleteAsync(string id, CancellationToken ct);
}
