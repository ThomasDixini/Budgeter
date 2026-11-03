using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

public sealed record SaveCardPaymentCommand(string Id, string CardId, string FromAccountId, DateOnly Date, long AmountCents);

/// <summary>Records or replaces a card invoice payment; saving the same payment twice leaves the same state.</summary>
public sealed class SaveCardPayment(ICardPaymentRepository payments, IAccountRepository accounts)
{
    /// <summary>
    /// Finds the card and the bank account, validates the payment between them and stores it.
    /// </summary>
    /// <example><code>await saveCardPayment.ExecuteAsync(new SaveCardPaymentCommand("p1", "credit-card", "checking-account", day, 234690), ct);</code></example>
    public async Task<CardPayment> ExecuteAsync(SaveCardPaymentCommand command, CancellationToken cancellationToken)
    {
        var card = await RequireAccountAsync(command.CardId, cancellationToken);
        var fromAccount = await RequireAccountAsync(command.FromAccountId, cancellationToken);
        var payment = CardPayment.Create(command.Id, card, fromAccount, command.Date, command.AmountCents);
        await payments.SaveAsync(payment, cancellationToken);
        return payment;
    }

    private async Task<Account> RequireAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(accountId, cancellationToken);
        return account ?? throw ResourceNotFoundException.For("account", accountId);
    }
}
