namespace Orbit.Api.Domain.Users;

/// <summary>A person with an account: the owner of every record stored in the app.</summary>
public sealed class User
{
    public const int MaxNameLength = 80;

    public string Id { get; }
    public string Email { get; }
    public string Name { get; }

    private User(string id, string email, string name)
    {
        Id = id;
        Email = email;
        Name = name;
    }

    /// <summary>
    /// Builds a valid new user with a generated id, a normalized e-mail and a trimmed name.
    /// </summary>
    /// <example><code>User.Register("Ana@Mail.com", "Ana").Email; // "ana@mail.com"</code></example>
    public static User Register(string email, string name) =>
        new(Guid.NewGuid().ToString(),
            EmailAddress.Normalize(email),
            RequiredText.Require(name, MaxNameLength, "name"));

    /// <summary>Rebuilds a stored user as it was saved, without today's rules.</summary>
    /// <example><code>User.Restore("u1", "ana@mail.com", "Ana");</code></example>
    internal static User Restore(string id, string email, string name) => new(id, email, name);
}
