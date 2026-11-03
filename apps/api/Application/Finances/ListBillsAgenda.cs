using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

/// <summary>What is to pay and to receive: bills and card invoices, plus the bills settled recently.</summary>
public sealed record BillsAgenda(IReadOnlyList<Bill> Bills, IReadOnlyList<CardInvoiceDue> CardInvoices);

/// <summary>
/// The bills page: every open bill that is overdue or due within the next <see cref="HorizonDays"/> days,
/// the ones settled in the last <see cref="SettledDays"/> days, and the card invoices left to pay.
/// </summary>
public sealed class ListBillsAgenda(IBillRepository bills, IAccountRepository accounts, ListAccountStatements statements)
{
    public const int HorizonDays = 90;
    public const int SettledDays = 30;

    /// <summary>
    /// Reads the agenda as of a day.
    /// </summary>
    /// <example><code>var agenda = await listBillsAgenda.ExecuteAsync(new DateOnly(2026, 11, 3), ct);</code></example>
    public async Task<BillsAgenda> ExecuteAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var open = await bills.ListOpenDueBeforeAsync(asOf.AddDays(HorizonDays + 1), cancellationToken);
        var settled = await bills.ListSettledSinceAsync(asOf.AddDays(-SettledDays), cancellationToken);
        var invoices = await CardInvoicesAsync(asOf, cancellationToken);
        return new BillsAgenda([.. open, .. settled], invoices);
    }

    private async Task<IReadOnlyList<CardInvoiceDue>> CardInvoicesAsync(DateOnly asOf, CancellationToken cancellationToken)
    {
        var limits = (await accounts.ListAsync(cancellationToken))
            .Where(account => account.Card is not null)
            .ToDictionary(account => account.Id, account => account.Card!.LimitCents);
        var invoices = new List<CardInvoiceDue>();
        foreach (var statement in await statements.ExecuteAsync(asOf, cancellationToken))
        {
            if (statement.Card is { } card && limits.TryGetValue(statement.AccountId, out var limit))
            {
                invoices.AddRange(CardInvoiceDue.From(statement.AccountId, limit, card));
            }
        }
        return invoices;
    }
}
