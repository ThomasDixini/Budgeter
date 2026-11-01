using Budgeter.Api.Domain.Categories;

namespace Budgeter.Api.Application.Categories;

public sealed record CreateCategoryCommand(string Id, string Name, string Color);

/// <summary>
/// Creates a category; retrying with the same id and contents returns the stored one instead of
/// duplicating it, while the same id with other contents is a conflict.
/// </summary>
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
        if (await categories.AddAsync(category, cancellationToken))
        {
            return new Creation<Category>(category, WasCreated: true);
        }
        var stored = await categories.FindAsync(category.Id, cancellationToken)
            ?? throw ResourceNotFoundException.For("category", category.Id);
        RequireSameContent(stored, category);
        return new Creation<Category>(stored, WasCreated: false);
    }

    private static void RequireSameContent(Category stored, Category received)
    {
        if (stored.HasSameContentAs(received)) return;
        throw ConflictException.For("category", stored.Id, stored.Describe(), received.Describe());
    }
}
