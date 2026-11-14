using Orbit.Api.Application.Notes;
using Orbit.Api.Domain.Notes;

namespace Orbit.Api.Endpoints;

/// <summary>Body of <c>PUT /notes/{id}</c>; the id comes from the route and a missing body means empty text.</summary>
public sealed record SaveNoteRequest(NoteKind Kind, string Title, string? Body = null)
{
    public SaveNoteCommand ToCommand(string id) => new(id, Kind, Title, Body);
}

/// <summary>Body of <c>PUT /notes/{id}/status</c>.</summary>
public sealed record SetNoteStatusRequest(NoteStatus Status)
{
    public SetNoteStatusCommand ToCommand(string id) => new(id, Status);
}

public sealed record NoteResponse(
    string Id, NoteKind Kind, string Title, string Body, NoteStatus Status,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static NoteResponse From(Note note) =>
        new(note.Id, note.Kind, note.Title, note.Body, note.Status, note.CreatedAt, note.UpdatedAt);
}

/// <summary>HTTP routes for the personal goals, notes and ideas.</summary>
public static class NoteEndpoints
{
    /// <summary>
    /// Maps <c>GET /notes</c>, <c>PUT /notes/{id}</c>, <c>PUT /notes/{id}/status</c> and <c>DELETE /notes/{id}</c>.
    /// </summary>
    /// <example><code>app.MapNoteEndpoints();</code></example>
    public static IEndpointRouteBuilder MapNoteEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/notes", ListAsync);
        routes.MapPut("/notes/{id}", SaveAsync);
        routes.MapPut("/notes/{id}/status", SetStatusAsync);
        routes.MapDelete("/notes/{id}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListNotes listNotes, CancellationToken cancellationToken)
    {
        var notes = await listNotes.ExecuteAsync(cancellationToken);
        return Results.Ok(notes.Select(NoteResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string id, SaveNoteRequest request, SaveNote saveNote, CancellationToken cancellationToken)
    {
        var saved = await saveNote.ExecuteAsync(request.ToCommand(id), cancellationToken);
        return Results.Ok(NoteResponse.From(saved));
    }

    private static async Task<IResult> SetStatusAsync(
        string id, SetNoteStatusRequest request, SetNoteStatus setNoteStatus, CancellationToken cancellationToken)
    {
        var updated = await setNoteStatus.ExecuteAsync(request.ToCommand(id), cancellationToken);
        return Results.Ok(NoteResponse.From(updated));
    }

    private static async Task<IResult> DeleteAsync(
        string id, DeleteNote deleteNote, CancellationToken cancellationToken)
    {
        await deleteNote.ExecuteAsync(id, cancellationToken);
        return Results.NoContent();
    }
}
