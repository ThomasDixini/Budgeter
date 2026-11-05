using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

public sealed record FinanceCategoryResponse(string Id, string Name)
{
    public static FinanceCategoryResponse From(FinanceCategory category) => new(category.Id, category.Name);
}

/// <summary>HTTP routes for the finance categories transactions are filed under.</summary>
public static class FinanceReferenceEndpoints
{
    /// <summary>
    /// Maps <c>GET /finance-categories</c>.
    /// </summary>
    /// <example><code>app.MapFinanceReferenceEndpoints();</code></example>
    public static IEndpointRouteBuilder MapFinanceReferenceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/finance-categories", ListCategoriesAsync);
        return routes;
    }

    private static async Task<IResult> ListCategoriesAsync(
        ListFinanceCategories listCategories, CancellationToken cancellationToken)
    {
        var categories = await listCategories.ExecuteAsync(cancellationToken);
        return Results.Ok(categories.Select(FinanceCategoryResponse.From));
    }
}
