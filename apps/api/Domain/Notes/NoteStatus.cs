namespace Orbit.Api.Domain.Notes;

/// <summary>Where a note stands in its life.</summary>
public enum NoteStatus
{
    /// <summary>Active and shown by default.</summary>
    Open,

    /// <summary>Achieved or settled; only goals and ideas can be done.</summary>
    Done,

    /// <summary>Put away without deleting it.</summary>
    Archived,
}
