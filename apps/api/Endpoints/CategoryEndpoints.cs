using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Endpoints;

public sealed record CreateCategoryRequest(string Id, string Name, string Color);

public sealed record CategoryResponse(string Id, string Name, string Color)
{
    public static CategoryResponse From(Category category) => new(category.Id, category.Name, category.Color);
}

/// <summary>HTTP routes for categories.</summary>
public static class CategoryEndpoints
{
    /// <summary>
    /// Maps <c>GET /categories</c> and <c>POST /categories</c>.
    /// </summary>
    /// <example><code>app.MapCategoryEndpoints();</code></example>
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/categories", ListAsync);
        routes.MapPost("/categories", CreateAsync);
        return routes;
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
