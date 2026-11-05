using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

/// <summary>A credit card's limit (in cents) and the days its invoices close and are due.</summary>
public sealed record CardTermsBody(long LimitCents, int ClosingDay, int DueDay)
{
    public static CardTermsBody? From(CardTerms? terms) =>
        terms is null ? null : new(terms.LimitCents, terms.ClosingDay, terms.DueDay);

    public CardTermsCommand ToCommand() => new(LimitCents, ClosingDay, DueDay);
}

/// <summary>Body of <c>PUT /accounts/{accountId}</c>; the id comes from the route.</summary>
public sealed record SaveAccountRequest(
    string Name, AccountKind Kind, long OpeningBalanceCents = 0, CardTermsBody? Card = null)
{
    public SaveAccountCommand ToCommand(string accountId) =>
        new(accountId, Name, Kind, OpeningBalanceCents, Card?.ToCommand());
}

public sealed record AccountResponse(string Id, string Name, AccountKind Kind, long OpeningBalanceCents, CardTermsBody? Card)
{
    public static AccountResponse From(Account account) =>
        new(account.Id, account.Name, account.Kind, account.OpeningBalanceCents, CardTermsBody.From(account.Card));
}

public sealed record InvoiceResponse(DateOnly StartsOn, DateOnly ClosesOn, DateOnly DueOn, long AmountCents)
{
    public static InvoiceResponse From(InvoiceStatement invoice) =>
        new(invoice.Cycle.StartsOn, invoice.Cycle.ClosesOn, invoice.Cycle.DueOn, invoice.AmountCents);
}

public sealed record CardStatementResponse(
    long AvailableLimitCents, long AmountDueCents, InvoiceResponse OpenInvoice, InvoiceResponse ClosedInvoice)
{
    public static CardStatementResponse? From(CardStatement? card) =>
        card is null
            ? null
            : new(card.AvailableLimitCents, card.AmountDueCents,
                InvoiceResponse.From(card.OpenInvoice), InvoiceResponse.From(card.ClosedInvoice));
}

public sealed record AccountStatementResponse(string AccountId, long BalanceCents, CardStatementResponse? Card)
{
    public static AccountStatementResponse From(AccountStatement statement) =>
        new(statement.AccountId, statement.BalanceCents, CardStatementResponse.From(statement.Card));
}

/// <summary>HTTP routes for bank accounts and credit cards, and where each of them stands.</summary>
public static class AccountEndpoints
{
    /// <summary>
    /// Maps <c>GET /accounts</c>, <c>PUT</c>/<c>DELETE /accounts/{accountId}</c> and
    /// <c>GET /account-statements?date=YYYY-MM-DD</c>.
    /// </summary>
    /// <example><code>app.MapAccountEndpoints();</code></example>
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/accounts", ListAsync);
        routes.MapPut("/accounts/{accountId}", SaveAsync);
        routes.MapDelete("/accounts/{accountId}", DeleteAsync);
        routes.MapGet("/account-statements", ListStatementsAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListAccounts listAccounts, CancellationToken cancellationToken)
    {
        var accounts = await listAccounts.ExecuteAsync(cancellationToken);
        return Results.Ok(accounts.Select(AccountResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string accountId, SaveAccountRequest request, SaveAccount saveAccount, CancellationToken cancellationToken)
    {
        var account = await saveAccount.ExecuteAsync(request.ToCommand(accountId), cancellationToken);
        return Results.Ok(AccountResponse.From(account));
    }

    private static async Task<IResult> DeleteAsync(
        string accountId, DeleteAccount deleteAccount, CancellationToken cancellationToken)
    {
        await deleteAccount.ExecuteAsync(accountId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListStatementsAsync(
        DateOnly date, ListAccountStatements listStatements, CancellationToken cancellationToken)
    {
        var statements = await listStatements.ExecuteAsync(date, cancellationToken);
        return Results.Ok(statements.Select(AccountStatementResponse.From));
    }
}
