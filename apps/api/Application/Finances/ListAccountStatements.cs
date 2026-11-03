using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>
/// Where every account stands on a day: bank balances, and each card's debt and invoices. Counts only what
/// is dated up to that day, so a transaction recorded ahead of time waits for its date.
/// </summary>
public sealed class ListAccountStatements(
    IAccountRepository accounts, IMoneyTransactionRepository transactions, ICardPaymentRepository payments)
{
    /// <summary>
    /// Returns one statement per account, in creation order.
    /// </summary>
    /// <example><code>var statements = await listAccountStatements.ExecuteAsync(new DateOnly(2026, 11, 3), ct);</code></example>
    public async Task<IReadOnlyList<AccountStatement>> ExecuteAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var statements = new List<AccountStatement>();
        foreach (var account in await accounts.ListAsync(cancellationToken))
        {
            statements.Add(await StatementOfAsync(account, asOf, cancellationToken));
        }
        return statements;
    }

    private Task<AccountStatement> StatementOfAsync(Account account, DateOnly asOf, CancellationToken cancellationToken) =>
        account.Card is { } terms
            ? CardStatementAsync(account, terms, asOf, cancellationToken)
            : BankStatementAsync(account, asOf, cancellationToken);

    private async Task<AccountStatement> BankStatementAsync(Account account, DateOnly asOf, CancellationToken cancellationToken)
    {
        var until = asOf.AddDays(1);
        var transactionsCents = await transactions.SumAsync(account.Id, DateOnly.MinValue, until, cancellationToken);
        var paidOutCents = await payments.SumPaidFromAsync(account.Id, until, cancellationToken);
        return AccountStatement.ForBankAccount(account, transactionsCents, paidOutCents);
    }

    private async Task<AccountStatement> CardStatementAsync(
        Account card, CardTerms terms, DateOnly asOf, CancellationToken cancellationToken)
    {
        var until = asOf.AddDays(1);
        var open = terms.CycleContaining(asOf);
        var closed = terms.CycleBefore(open);
        var sums = new CardSums(
            await transactions.SumAsync(card.Id, open.StartsOn, until, cancellationToken),
            await transactions.SumAsync(card.Id, closed.StartsOn, closed.ClosesOn, cancellationToken),
            await transactions.SumAsync(card.Id, DateOnly.MinValue, until, cancellationToken),
            await payments.SumPaidToAsync(card.Id, until, cancellationToken));
        return AccountStatement.ForCreditCard(card, terms, open, sums);
    }
}
