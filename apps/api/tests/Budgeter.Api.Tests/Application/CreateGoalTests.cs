using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class CreateGoalTests
{
    private readonly InMemoryCategoryRepository _categories = new(Category.Create("study", "Study", "#7DD3FC"));

    [Fact]
    public async Task ExecuteAsync_StoresGoalWithoutProgress()
    {
        var goals = new InMemoryGoalRepository();

        var creation = await new CreateGoal(goals, _categories)
            .ExecuteAsync(GoalDefinitions.WeeklyStudy(), CancellationToken.None);

        creation.WasCreated.ShouldBeTrue();
        (await goals.FindAsync("g1", CancellationToken.None))!.Done.ShouldBe(0);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsUnknownCategory()
    {
        var createGoal = new CreateGoal(new InMemoryGoalRepository(), _categories);

        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            createGoal.ExecuteAsync(GoalDefinitions.WeeklyStudy(categoryId: "unknown"), CancellationToken.None));

        exception.Message.ShouldContain("\"unknown\"");
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsStoredGoalOnRetry()
    {
        var goals = new InMemoryGoalRepository(Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 2));

        var creation = await new CreateGoal(goals, _categories)
            .ExecuteAsync(GoalDefinitions.WeeklyStudy(), CancellationToken.None);

        creation.WasCreated.ShouldBeFalse();
        creation.Record.Done.ShouldBe(2);
        goals.AddCount.ShouldBe(0);
    }
}
