using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

public sealed record CardTermsCommand(long LimitCents, int ClosingDay, int DueDay);

public sealed record SaveAccountCommand(
    string Id, string Name, AccountKind Kind, long OpeningBalanceCents, CardTermsCommand? Card);

/// <summary>
/// Creates or replaces a bank account or credit card; saving the same account twice leaves the same state.
/// An account never changes kind: its transactions and payments were recorded for that kind.
/// </summary>
public sealed class SaveAccount(IAccountRepository accounts)
{
    /// <summary>
    /// Validates the account, checks a stored one keeps its kind and stores it.
    /// </summary>
    /// <example><code>await saveAccount.ExecuteAsync(new SaveAccountCommand("nubank", "Nubank", AccountKind.BankAccount, 842035, Card: null), ct);</code></example>
    public async Task<Account> ExecuteAsync(SaveAccountCommand command, CancellationToken cancellationToken)
    {
        var account = Account.Create(
            command.Id, command.Name, command.Kind, command.OpeningBalanceCents, TermsOf(command.Card));
        await RequireSameKindAsync(account, cancellationToken);
        await accounts.SaveAsync(account, cancellationToken);
        return account;
    }

    private static CardTerms? TermsOf(CardTermsCommand? card) =>
        card is null ? null : CardTerms.Create(card.LimitCents, card.ClosingDay, card.DueDay);

    private async Task RequireSameKindAsync(Account account, CancellationToken cancellationToken)
    {
        var stored = await accounts.FindAsync(account.Id, cancellationToken);
        if (stored is null || stored.Kind == account.Kind) return;
        throw new ConflictException(
            $"Expected account \"{account.Id}\" to stay a {stored.Kind}, received {account.Kind}");
    }
}
