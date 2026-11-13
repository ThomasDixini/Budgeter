namespace Orbit.Api.Domain.Notes;

/// <summary>What a note is for.</summary>
public enum NoteKind
{
    /// <summary>Something the user wants to achieve; can be marked done.</summary>
    Goal,

    /// <summary>Free text worth keeping; it is never "done".</summary>
    Note,

    /// <summary>A thought to revisit later; can be marked done.</summary>
    Idea,
}
