using Orbit.Api.Application.Notes;
using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Note storage kept in a list, for use case tests.</summary>
internal sealed class InMemoryNoteRepository : INoteRepository
{
    private readonly List<Note> _notes = [];

    public Task<Note?> FindAsync(string id, CancellationToken ct)
    {
        return Task.FromResult(_notes.Find(note => note.Id == id));
    }

    public Task<IReadOnlyList<Note>> ListAsync(CancellationToken ct)
    {
        var ordered = _notes.OrderByDescending(note => note.UpdatedAt).ThenBy(note => note.Id, StringComparer.Ordinal);
        return Task.FromResult<IReadOnlyList<Note>>(ordered.ToList());
    }

    public Task SaveAsync(Note note, CancellationToken ct)
    {
        var index = _notes.FindIndex(stored => stored.Id == note.Id);
        if (index < 0) _notes.Add(note);
        else _notes[index] = note;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken ct)
    {
        _notes.RemoveAll(note => note.Id == id);
        return Task.CompletedTask;
    }
}
