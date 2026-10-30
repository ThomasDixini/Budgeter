using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Application.Categories;

public sealed record UpdateCategoryCommand(string Id, string Name, string Color);

/// <summary>Renames and recolors a category; the id never changes, so goals and blocks keep pointing at it.</summary>
public sealed class UpdateCategory(ICategoryRepository categories)
{
    /// <summary>
    /// Validates the new name and color and stores them over the existing category.
    /// </summary>
    /// <example><code>await updateCategory.ExecuteAsync(new("languages", "Spanish", "#7DD3FC"), ct);</code></example>
    public async Task<Category> ExecuteAsync(UpdateCategoryCommand command, CancellationToken cancellationToken)
    {
        var category = Category.Create(command.Id, command.Name, command.Color);
        var existing = await categories.FindAsync(category.Id, cancellationToken);
        if (existing is null) throw ResourceNotFoundException.For("category", category.Id);

        await categories.UpdateAsync(category, cancellationToken);
        return category;
    }
}
