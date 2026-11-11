namespace Orbit.Api.Application;

/// <summary>Port to the person the running request acts for; every stored record belongs to them.</summary>
public interface ICurrentUser
{
    /// <summary>The id of the signed-in user; throws when no one is signed in.</summary>
    string Id { get; }
}
