using Budgeter.Api.Application;
using Budgeter.Api.Application.Goals;
using Budgeter.Api.Application.Tasks;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Domain.Tasks;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class TaskUseCaseTests
{
    private static readonly DateOnly Today = new(2026, 10, 27);
    private readonly InMemoryCategoryRepository _categories = new(Category.Create("reading", "Reading", "#FBBF24"));
    private readonly InMemoryTaskRepository _tasks = new();
    private readonly InMemoryGoalRepository _goals = new();

    private static SaveTaskCommand ReadDaily(string? categoryId = "reading") =>
        new("t1", "Read 20 pages", categoryId, TaskRepeat.Daily, [], null);

    [Fact]
    public async Task Save_StoresTheTaskAndListsIt()
    {
        await new SaveTask(_tasks, _categories).ExecuteAsync(ReadDaily(), CancellationToken.None);

        var tasks = await new ListTasks(_tasks).ExecuteAsync(CancellationToken.None);
        tasks.Single().CategoryId.ShouldBe("reading");
    }

    [Fact]
    public async Task Save_AcceptsATaskWithoutCategory()
    {
        var task = await new SaveTask(_tasks, _categories).ExecuteAsync(ReadDaily(null), CancellationToken.None);

        task.CategoryId.ShouldBeNull();
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCategory()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            new SaveTask(_tasks, _categories).ExecuteAsync(ReadDaily("unknown"), CancellationToken.None));

        exception.Message.ShouldContain("\"unknown\"");
    }

    [Fact]
    public async Task Completions_MarkAndUnmarkADay()
    {
        await new SaveTask(_tasks, _categories).ExecuteAsync(ReadDaily(), CancellationToken.None);
        var completions = new TaskCompletions(_tasks, new GoalCredits(_goals, _goals));

        await completions.SetAsync("t1", Today, isDone: true, CancellationToken.None);
        var done = await completions.ListAsync(Today, CancellationToken.None);
        await completions.SetAsync("t1", Today, isDone: false, CancellationToken.None);

        done.ShouldBe(["t1"]);
        (await completions.ListAsync(Today, CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Completions_RejectAnUnknownTask()
    {
        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            new TaskCompletions(_tasks, new GoalCredits(_goals, _goals)).SetAsync("missing", Today, isDone: true, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_RemovesTheTaskAndIgnoresOneAlreadyGone()
    {
        await new SaveTask(_tasks, _categories).ExecuteAsync(ReadDaily(), CancellationToken.None);
        var deleteTask = new DeleteTask(_tasks);

        await deleteTask.ExecuteAsync("t1", CancellationToken.None);
        await deleteTask.ExecuteAsync("t1", CancellationToken.None);

        (await _tasks.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
