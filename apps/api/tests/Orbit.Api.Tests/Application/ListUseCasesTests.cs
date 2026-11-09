using Orbit.Api.Application.Categories;
using Orbit.Api.Application.Goals;
using Orbit.Api.Domain.Categories;
using Orbit.Api.Domain.Goals;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

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

        var goals = await new ListGoals(repository).ExecuteAsync(TestDays.Today, CancellationToken.None);

        goals.Select(goal => goal.Id).ShouldBe(["g1"]);
    }
}
