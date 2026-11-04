using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

public sealed record SaveTransactionCommand(
    string Id, DateOnly Date, string Description, string CategoryId, string AccountId, long AmountCents);

/// <summary>Creates or replaces a transaction; saving the same transaction twice leaves the same state.</summary>
public sealed class SaveTransaction(
    IMoneyTransactionRepository transactions, IFinanceCategoryRepository categories, IAccountRepository accounts)
{
    /// <summary>
    /// Validates the transaction, checks its category and account exist and stores it.
    /// </summary>
    /// <example><code>await saveTransaction.ExecuteAsync(new SaveTransactionCommand("tx1", day, "Groceries", "food", "credit-card", -28640), ct);</code></example>
    public async Task<MoneyTransaction> ExecuteAsync(SaveTransactionCommand command, CancellationToken cancellationToken)
    {
        var transaction = MoneyTransaction.Create(
            command.Id, command.Date, command.Description, command.CategoryId, command.AccountId, command.AmountCents);
        await RequireCategoryAsync(transaction.CategoryId, cancellationToken);
        await RequireAccountAsync(transaction.AccountId, cancellationToken);
        await transactions.SaveAsync(transaction, cancellationToken);
        return transaction;
    }

    private async Task RequireCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(categoryId, cancellationToken);
        if (category is null) throw ResourceNotFoundException.For("finance category", categoryId);
    }

    private async Task RequireAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(accountId, cancellationToken);
        if (account is null) throw ResourceNotFoundException.For("account", accountId);
    }
}
