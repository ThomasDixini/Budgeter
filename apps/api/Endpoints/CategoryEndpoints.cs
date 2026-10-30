using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Endpoints;

public sealed record CreateCategoryRequest(string Id, string Name, string Color);

/// <summary>Body of <c>PUT /categories/{categoryId}</c>; the id comes from the route.</summary>
public sealed record UpdateCategoryRequest(string Name, string Color);

public sealed record CategoryResponse(string Id, string Name, string Color)
{
    public static CategoryResponse From(Category category) => new(category.Id, category.Name, category.Color);
}

/// <summary>HTTP routes for categories.</summary>
public static class CategoryEndpoints
{
    /// <summary>
    /// Maps <c>GET /categories</c>, <c>POST /categories</c>, <c>PUT /categories/{categoryId}</c> and
    /// <c>DELETE /categories/{categoryId}</c>.
    /// </summary>
    /// <example><code>app.MapCategoryEndpoints();</code></example>
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/categories", ListAsync);
        routes.MapPost("/categories", CreateAsync);
        routes.MapPut("/categories/{categoryId}", UpdateAsync);
        routes.MapDelete("/categories/{categoryId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> UpdateAsync(
        string categoryId, UpdateCategoryRequest request, UpdateCategory updateCategory,
        CancellationToken cancellationToken)
    {
        var category = await updateCategory.ExecuteAsync(
            new UpdateCategoryCommand(categoryId, request.Name, request.Color), cancellationToken);
        return Results.Ok(CategoryResponse.From(category));
    }

    private static async Task<IResult> DeleteAsync(
        string categoryId, DeleteCategory deleteCategory, CancellationToken cancellationToken)
    {
        await deleteCategory.ExecuteAsync(categoryId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListAsync(ListCategories listCategories, CancellationToken cancellationToken)
    {
        var categories = await listCategories.ExecuteAsync(cancellationToken);
        return Results.Ok(categories.Select(CategoryResponse.From));
    }

    private static async Task<IResult> CreateAsync(
        CreateCategoryRequest request, CreateCategory createCategory, CancellationToken cancellationToken)
    {
        var creation = await createCategory.ExecuteAsync(
            new CreateCategoryCommand(request.Id, request.Name, request.Color), cancellationToken);
        var response = CategoryResponse.From(creation.Record);
        return creation.WasCreated ? Results.Created($"/categories/{response.Id}", response) : Results.Ok(response);
    }
}
