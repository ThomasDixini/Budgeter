using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Application.Categories;

public sealed record CreateCategoryCommand(string Id, string Name, string Color);

/// <summary>Creates a category; retrying with the same id returns the stored one instead of duplicating it.</summary>
public sealed class CreateCategory(ICategoryRepository categories)
{
    /// <summary>
    /// Validates and stores the category unless its id is already saved.
    /// </summary>
    /// <example><code>await createCategory.ExecuteAsync(new("languages", "Languages", "#86EFAC"), ct);</code></example>
    public async Task<Creation<Category>> ExecuteAsync(
        CreateCategoryCommand command, CancellationToken cancellationToken)
    {
        var category = Category.Create(command.Id, command.Name, command.Color);
        var existing = await categories.FindAsync(category.Id, cancellationToken);
        if (existing is not null) return new Creation<Category>(existing, WasCreated: false);

        await categories.AddAsync(category, cancellationToken);
        return new Creation<Category>(category, WasCreated: true);
    }
}
