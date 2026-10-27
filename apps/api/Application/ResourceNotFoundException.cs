namespace Budgeter.Api.Application;

/// <summary>Raised when a use case references a record that does not exist.</summary>
/// <example><code>throw ResourceNotFoundException.For("category", "study");</code></example>
public sealed class ResourceNotFoundException(string message) : Exception(message)
{
    /// <summary>
    /// Builds the exception naming the kind of record and the missing id.
    /// </summary>
    /// <example><code>ResourceNotFoundException.For("goal", "g1").Message; // "Expected an existing goal with id \"g1\", found none"</code></example>
    public static ResourceNotFoundException For(string kind, string id)
    {
        return new ResourceNotFoundException($"Expected an existing {kind} with id \"{id}\", found none");
    }
}
