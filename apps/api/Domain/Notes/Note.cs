namespace Orbit.Api.Domain.Notes;

/// <summary>
/// A short written item: a goal, a note or an idea, with free text and a status but no dates or progress.
/// </summary>
public sealed class Note
{
    public const int MaxTitleLength = 80;
    public const int MaxBodyLength = 4000;

    public string Id { get; }
    public NoteKind Kind { get; }
    public string Title { get; }
    public string Body { get; }
    public NoteStatus Status { get; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; }

    private Note(
        string id, NoteKind kind, string title, string body, NoteStatus status,
        DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        Id = id;
        Kind = kind;
        Title = title;
        Body = body;
        Status = status;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
    }

    /// <summary>Builds a valid open note; the body is kept exactly as typed.</summary>
    /// <example><code>Note.Create("n1", NoteKind.Idea, "Try a standing desk", null, now).Status; // Open</code></example>
    public static Note Create(string id, NoteKind kind, string title, string? body, DateTimeOffset now)
    {
        return new Note(
            EntityId.Require(id, "note id"),
            RequireKind(kind),
            RequiredText.Require(title, MaxTitleLength, "note title"),
            RequireBody(body),
            NoteStatus.Open,
            now,
            now);
    }

    /// <summary>
    /// Rebuilds a stored note as it was saved, without today's rules, so a stricter rule never makes an
    /// old note unreadable.
    /// </summary>
    /// <example><code>Note.Restore("n1", NoteKind.Goal, "Run", "", NoteStatus.Done, created, updated);</code></example>
    internal static Note Restore(
        string id, NoteKind kind, string title, string body, NoteStatus status,
        DateTimeOffset createdAt, DateTimeOffset updatedAt) =>
        new(id, kind, title, body, status, createdAt, updatedAt);

    /// <summary>Returns the note with new content, keeping its id, status and creation time.</summary>
    /// <example><code>note.Edited(NoteKind.Goal, "Run a 10k", "", now).Status; // unchanged</code></example>
    public Note Edited(NoteKind kind, string title, string? body, DateTimeOffset now)
    {
        RequireKind(kind);
        if (Status == NoteStatus.Done && kind == NoteKind.Note)
        {
            throw new DomainRuleException(
                $"Expected a done item to stay a goal or an idea, received kind \"{kind}\"");
        }
        return new Note(
            Id, kind, RequiredText.Require(title, MaxTitleLength, "note title"), RequireBody(body),
            Status, CreatedAt, now);
    }

    /// <summary>Returns the note with another status; only goals and ideas can be done.</summary>
    /// <example><code>goal.WithStatus(NoteStatus.Done, now).Status; // Done</code></example>
    public Note WithStatus(NoteStatus status, DateTimeOffset now)
    {
        if (!Enum.IsDefined(status))
        {
            throw new DomainRuleException($"Expected a note status of Open, Done or Archived, received {(int)status}");
        }
        if (status == NoteStatus.Done && Kind == NoteKind.Note)
        {
            throw new DomainRuleException(
                $"Expected a goal or an idea to be marked done, received kind \"{Kind}\"");
        }
        return new Note(Id, Kind, Title, Body, status, CreatedAt, now);
    }

    private static NoteKind RequireKind(NoteKind kind)
    {
        if (Enum.IsDefined(kind)) return kind;
        throw new DomainRuleException($"Expected a note kind of Goal, Note or Idea, received {(int)kind}");
    }

    private static string RequireBody(string? body)
    {
        if (body is null) return "";
        if (body.Length <= MaxBodyLength) return body;
        throw new DomainRuleException(
            $"Expected the note text to have at most {MaxBodyLength} characters, received {body.Length} characters");
    }
}
