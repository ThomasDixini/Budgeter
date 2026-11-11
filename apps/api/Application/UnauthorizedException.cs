namespace Orbit.Api.Application;

/// <summary>
/// Raised when credentials do not match an account. The message is the same whether the e-mail is unknown or
/// the password is wrong, so it does not reveal which e-mails have an account.
/// </summary>
/// <example><code>throw new UnauthorizedException();</code></example>
public sealed class UnauthorizedException()
    : Exception("Expected an e-mail and password that match an account, received a pair that does not");
