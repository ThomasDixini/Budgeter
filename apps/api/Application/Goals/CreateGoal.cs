using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Goals;

namespace Budgeter.Api.Application.Goals;

/// <summary>Sets a goal on an existing category; retrying with the same id returns the stored goal.</summary>
public sealed class CreateGoal(IGoalRepository goals, ICategoryRepository categories)
{
    /// <summary>
    /// Validates the definition, checks the category exists and stores the goal with no progress.
    /// </summary>
    /// <example><code>await createGoal.ExecuteAsync(new GoalDefinition("g1", "study", "Study C#", GoalType.Frequency, GoalPeriod.Weekly, 5, null, null), ct);</code></example>
    public async Task<Creation<Goal>> ExecuteAsync(
        GoalDefinition definition, CancellationToken cancellationToken)
    {
        var goal = Goal.Create(definition);
        var existing = await goals.FindAsync(goal.Id, cancellationToken);
        if (existing is not null) return new Creation<Goal>(existing, WasCreated: false);

        await RequireCategoryAsync(goal.CategoryId, cancellationToken);
        await goals.AddAsync(goal, cancellationToken);
        return new Creation<Goal>(goal, WasCreated: true);
    }

    private async Task RequireCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(categoryId, cancellationToken);
        if (category is null) throw ResourceNotFoundException.For("category", categoryId);
    }
}
