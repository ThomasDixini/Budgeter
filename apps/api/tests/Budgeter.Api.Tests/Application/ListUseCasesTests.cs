using Budgeter.Api.Application.Categories;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class ListUseCasesTests
{
    [Fact]
    public async Task ListCategories_ReturnsStoredCategories()
    {
        var repository = new InMemoryCategoryRepository(Category.Create("study", "Study", "#7DD3FC"));

        var categories = await new ListCategories(repository).ExecuteAsync(CancellationToken.None);

        categories.Select(category => category.Id).ShouldBe(["study"]);
    }

    [Fact]
    public async Task ListGoals_ReturnsStoredGoals()
    {
        var repository = new InMemoryGoalRepository(Goal.Create(GoalDefinitions.WeeklyStudy()));

        var goals = await new ListGoals(repository).ExecuteAsync(CancellationToken.None);

        goals.Select(goal => goal.Id).ShouldBe(["g1"]);
    }
}
