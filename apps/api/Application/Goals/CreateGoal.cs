using Orbit.Api.Application.Categories;
using Orbit.Api.Domain.Goals;

namespace Orbit.Api.Application.Goals;

/// <summary>
/// Sets a goal on an existing category; retrying with the same id and definition returns the stored
/// goal, while the same id with another definition is a conflict.
/// </summary>
public sealed class CreateGoal(IGoalRepository goals, ICategoryRepository categories)
{
    /// <summary>
    /// Validates the definition, checks the category exists and stores the goal with no progress. A retry
    /// answers with the stored goal and its progress around <paramref name="day"/>.
    /// </summary>
    /// <example><code>await createGoal.ExecuteAsync(new GoalDefinition("g1", "study", "Study C#", GoalType.Frequency, GoalPeriod.Weekly, 5, null, null), day, ct);</code></example>
    public async Task<Creation<Goal>> ExecuteAsync(
        GoalDefinition definition, DateOnly day, CancellationToken cancellationToken)
    {
        var goal = Goal.Create(definition);
        await RequireCategoryAsync(goal.CategoryId, cancellationToken);
        if (await goals.AddAsync(goal, cancellationToken)) return new Creation<Goal>(goal, WasCreated: true);

        var stored = await goals.FindAsync(goal.Id, day, cancellationToken)
            ?? throw ResourceNotFoundException.For("goal", goal.Id);
        RequireSameDefinition(stored, goal);
        return new Creation<Goal>(stored, WasCreated: false);
    }

    private async Task RequireCategoryAsync(string categoryId, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(categoryId, cancellationToken);
        if (category is null) throw ResourceNotFoundException.For("category", categoryId);
    }

    private static void RequireSameDefinition(Goal stored, Goal received)
    {
        if (stored.HasSameDefinitionAs(received)) return;
        throw ConflictException.For("goal", stored.Id, stored.Definition.ToString(), received.Definition.ToString());
    }
}
