using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

/// <summary>Body of <c>PUT /transactions/{transactionId}</c>; the id comes from the route.</summary>
public sealed record SaveTransactionRequest(
    DateOnly Date, string Description, string CategoryId, string AccountId, long AmountCents)
{
    public SaveTransactionCommand ToCommand(string transactionId) =>
        new(transactionId, Date, Description, CategoryId, AccountId, AmountCents);
}

public sealed record TransactionResponse(
    string Id, DateOnly Date, string Description, string CategoryId, string AccountId, long AmountCents)
{
    public static TransactionResponse From(MoneyTransaction transaction) =>
        new(transaction.Id, transaction.Date, transaction.Description, transaction.CategoryId,
            transaction.AccountId, transaction.AmountCents);
}

/// <summary>HTTP routes for money transactions.</summary>
public static class TransactionEndpoints
{
    /// <summary>
    /// Maps <c>GET /transactions?month=YYYY-MM</c> and <c>PUT</c>/<c>DELETE /transactions/{transactionId}</c>.
    /// </summary>
    /// <example><code>app.MapTransactionEndpoints();</code></example>
    public static IEndpointRouteBuilder MapTransactionEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/transactions", ListAsync);
        routes.MapPut("/transactions/{transactionId}", SaveAsync);
        routes.MapDelete("/transactions/{transactionId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        string month, ListTransactions listTransactions, CancellationToken cancellationToken)
    {
        var transactions = await listTransactions.ExecuteAsync(month, cancellationToken);
        return Results.Ok(transactions.Select(TransactionResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string transactionId, SaveTransactionRequest request, SaveTransaction saveTransaction,
        CancellationToken cancellationToken)
    {
        var transaction = await saveTransaction.ExecuteAsync(request.ToCommand(transactionId), cancellationToken);
        return Results.Ok(TransactionResponse.From(transaction));
    }

    private static async Task<IResult> DeleteAsync(
        string transactionId, DeleteTransaction deleteTransaction, CancellationToken cancellationToken)
    {
        await deleteTransaction.ExecuteAsync(transactionId, cancellationToken);
        return Results.NoContent();
    }
}
