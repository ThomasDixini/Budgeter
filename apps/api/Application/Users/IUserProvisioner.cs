namespace Orbit.Api.Application.Users;

/// <summary>Port that gives a new account what every account starts with (finance categories, sample data).</summary>
public interface IUserProvisioner
{
    /// <summary>Stores the starter records of the user, once; calling it again changes nothing.</summary>
    Task ProvisionAsync(string userId, CancellationToken cancellationToken);
}
