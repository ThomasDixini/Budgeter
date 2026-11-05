using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

public sealed record FinanceCategoryResponse(string Id, string Name)
{
    public static FinanceCategoryResponse From(FinanceCategory category) => new(category.Id, category.Name);
}

/// <summary>Body of <c>PUT /finance-categories/{categoryId}</c>; the id comes from the route.</summary>
public sealed record SaveFinanceCategoryRequest(string Name)
{
    public SaveFinanceCategoryCommand ToCommand(string categoryId) => new(categoryId, Name);
}

/// <summary>HTTP routes for the finance categories transactions are filed under.</summary>
public static class FinanceReferenceEndpoints
{
    /// <summary>
    /// Maps <c>GET /finance-categories</c> and <c>PUT</c>/<c>DELETE /finance-categories/{categoryId}</c>.
    /// </summary>
    /// <example><code>app.MapFinanceReferenceEndpoints();</code></example>
    public static IEndpointRouteBuilder MapFinanceReferenceEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/finance-categories", ListCategoriesAsync);
        routes.MapPut("/finance-categories/{categoryId}", SaveCategoryAsync);
        routes.MapDelete("/finance-categories/{categoryId}", DeleteCategoryAsync);
        return routes;
    }

    private static async Task<IResult> ListCategoriesAsync(
        ListFinanceCategories listCategories, CancellationToken cancellationToken)
    {
        var categories = await listCategories.ExecuteAsync(cancellationToken);
        return Results.Ok(categories.Select(FinanceCategoryResponse.From));
    }

    private static async Task<IResult> SaveCategoryAsync(
        string categoryId, SaveFinanceCategoryRequest request, SaveFinanceCategory saveCategory,
        CancellationToken cancellationToken)
    {
        var category = await saveCategory.ExecuteAsync(request.ToCommand(categoryId), cancellationToken);
        return Results.Ok(FinanceCategoryResponse.From(category));
    }

    private static async Task<IResult> DeleteCategoryAsync(
        string categoryId, DeleteFinanceCategory deleteCategory, CancellationToken cancellationToken)
    {
        await deleteCategory.ExecuteAsync(categoryId, cancellationToken);
        return Results.NoContent();
    }
}
