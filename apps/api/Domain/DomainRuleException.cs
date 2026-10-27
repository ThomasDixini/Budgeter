namespace Budgeter.Api.Domain;

/// <summary>
/// Raised when input breaks a business rule; the message names the offending value and the expected shape.
/// </summary>
/// <example><code>throw new DomainRuleException("Expected a color shaped like #RRGGBB, received \"blue\"");</code></example>
public sealed class DomainRuleException(string message) : Exception(message);
