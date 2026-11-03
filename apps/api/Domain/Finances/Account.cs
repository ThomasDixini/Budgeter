namespace Budgeter.Api.Domain.Finances;

/// <summary>A bank account or credit card that transactions are paid from or received into.</summary>
public sealed class Account
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }
    public AccountKind Kind { get; }

    private Account(string id, string name, AccountKind kind)
    {
        Id = id;
        Name = name;
        Kind = kind;
    }

    /// <summary>
    /// Builds a valid account, trimming the name.
    /// </summary>
    /// <example><code>Account.Create("nubank", "Nubank", AccountKind.BankAccount).Name; // "Nubank"</code></example>
    public static Account Create(string id, string name, AccountKind kind)
    {
        return new Account(
            EntityId.Require(id, "account id"),
            RequiredText.Require(name, MaxNameLength, "account name"),
            kind);
    }

    /// <summary>
    /// Rebuilds a stored account as it was saved, without today's rules.
    /// </summary>
    /// <example><code>Account.Restore("nubank", "Nubank", AccountKind.BankAccount);</code></example>
    internal static Account Restore(string id, string name, AccountKind kind) => new(id, name, kind);
}
