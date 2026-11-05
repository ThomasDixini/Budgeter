using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Application.Finances;

public sealed record SaveFinanceCategoryCommand(string Id, string Name);

/// <summary>
/// Creates or renames a finance category; saving the same one twice leaves the same state. Names are
/// unique ignoring case, so two categories never read alike in a list.
/// </summary>
public sealed class SaveFinanceCategory(IFinanceCategoryRepository categories)
{
    /// <summary>
    /// Validates the category, checks no other one has the name and stores it.
    /// </summary>
    /// <example><code>await saveFinanceCategory.ExecuteAsync(new SaveFinanceCategoryCommand("courses", "Courses"), ct);</code></example>
    public async Task<FinanceCategory> ExecuteAsync(SaveFinanceCategoryCommand command, CancellationToken cancellationToken)
    {
        var category = FinanceCategory.Create(command.Id, command.Name);
        await RequireFreeNameAsync(category, cancellationToken);
        await categories.SaveAsync(category, cancellationToken);
        return category;
    }

    private async Task RequireFreeNameAsync(FinanceCategory category, CancellationToken cancellationToken)
    {
        var all = await categories.ListAsync(cancellationToken);
        var sameName = all.FirstOrDefault(other =>
            other.Id != category.Id && string.Equals(other.Name, category.Name, StringComparison.OrdinalIgnoreCase));
        if (sameName is null) return;
        throw new ConflictException(
            $"Expected the finance category name to be unused, received \"{category.Name}\" already taken by \"{sameName.Id}\"");
    }
}
