namespace Orbit.Api.Application;

/// <summary>
/// Raised when a create names an id that is already stored with other contents: a retry must repeat
/// what was sent the first time, so this is a client bug rather than a retry.
/// </summary>
/// <example><code>throw ConflictException.For("category", "study", "name \"Study\"", "name \"Learning\"");</code></example>
public sealed class ConflictException(string message) : Exception(message)
{
    /// <summary>
    /// Builds the exception naming the record, what is stored and what was received.
    /// </summary>
    /// <example><code>ConflictException.For("goal", "g1", "title \"Read\"", "title \"Write\"").Message;</code></example>
    public static ConflictException For(string kind, string id, string stored, string received)
    {
        return new ConflictException(
            $"Expected a retry of {kind} \"{id}\" to repeat what is stored ({stored}), received {received}");
    }
}
