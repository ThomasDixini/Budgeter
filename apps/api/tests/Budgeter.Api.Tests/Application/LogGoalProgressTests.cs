using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Domain.Goals;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class LogGoalProgressTests
{
    [Fact]
    public async Task ExecuteAsync_PersistsIncrementedProgress()
    {
        var goals = new InMemoryGoalRepository(Goal.Restore(GoalDefinitions.WeeklyStudy(), done: 3));

        var goal = await new LogGoalProgress(goals).ExecuteAsync("g1", CancellationToken.None);

        goal.Done.ShouldBe(4);
        (await goals.FindAsync("g1", CancellationToken.None))!.Done.ShouldBe(4);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsUnknownGoal()
    {
        var logGoalProgress = new LogGoalProgress(new InMemoryGoalRepository());

        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            logGoalProgress.ExecuteAsync("missing", CancellationToken.None));
    }
}
