using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

public sealed record FinanceCategoryResponse(string Id, string Name)
{
    public static FinanceCategoryResponse From(FinanceCategory category) => new(category.Id, category.Name);
}

public sealed record AccountResponse(string Id, string Name, AccountKind Kind)
{
    public static AccountResponse From(Account account) => new(account.Id, account.Name, account.Kind);
}

/// <summary>HTTP routes for what transactions refer to: finance categories and accounts.</summary>
public static class FinanceReferenceEndpoints
{
    /// <summary>
    /// Maps <c>GET /finance-categories</c> and <c>GET /accounts</c>.
    /// </summary>
    /// <example><code>app.MapFinanceReferenceEndpoints();</code></example>
    public static IEndpointRouteBuilder MapFinanceReferenceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/finance-categories", ListCategoriesAsync);
        routes.MapGet("/accounts", ListAccountsAsync);
        return routes;
    }

    private static async Task<IResult> ListCategoriesAsync(
        ListFinanceCategories listCategories, CancellationToken cancellationToken)
    {
        var categories = await listCategories.ExecuteAsync(cancellationToken);
        return Results.Ok(categories.Select(FinanceCategoryResponse.From));
    }

    private static async Task<IResult> ListAccountsAsync(ListAccounts listAccounts, CancellationToken cancellationToken)
    {
        var accounts = await listAccounts.ExecuteAsync(cancellationToken);
        return Results.Ok(accounts.Select(AccountResponse.From));
    }
}
