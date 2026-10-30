using Budgeter.Api.Application;
using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class SaveRoutineTests
{
    private readonly InMemoryCategoryRepository _categories = new(Category.Create("study", "Study", "#7DD3FC"));
    private readonly InMemoryRoutineRepository _routines = new();

    [Fact]
    public async Task ExecuteAsync_StoresANewRoutine()
    {
        var saved = await new SaveRoutine(_routines, _categories)
            .ExecuteAsync(Routines.WeekdaysCommand(), CancellationToken.None);

        saved.Blocks.Count.ShouldBe(2);
        (await new ListRoutines(_routines).ExecuteAsync(CancellationToken.None)).Single().Id.ShouldBe("weekdays");
    }

    [Fact]
    public async Task ExecuteAsync_ReplacesTheStoredRoutine()
    {
        var routines = new InMemoryRoutineRepository(Routines.Weekdays());

        await new SaveRoutine(routines, _categories)
            .ExecuteAsync(Routines.WeekdaysCommand(studyCategoryId: null), CancellationToken.None);

        var stored = (await routines.ListAsync(CancellationToken.None)).Single();
        stored.Blocks.ShouldAllBe(block => block.CategoryId == null);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsWeekdaysAnotherRoutineUses()
    {
        var routines = new InMemoryRoutineRepository(Routines.Weekdays());
        var overlapping = new SaveRoutineCommand("friday-late", "Friday late", [4, 5], "09:00", "18:00", []);

        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            new SaveRoutine(routines, _categories).ExecuteAsync(overlapping, CancellationToken.None));

        exception.Message.ShouldContain("[4]");
        exception.Message.ShouldContain("Weekdays");
        routines.SaveCount.ShouldBe(0);
    }

    [Fact]
    public async Task ExecuteAsync_AllowsResavingARoutineOnItsOwnDays()
    {
        var routines = new InMemoryRoutineRepository(Routines.Weekdays());

        await new SaveRoutine(routines, _categories)
            .ExecuteAsync(Routines.WeekdaysCommand(), CancellationToken.None);

        (await routines.ListAsync(CancellationToken.None)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsUnknownBlockCategory()
    {
        var saveRoutine = new SaveRoutine(_routines, _categories);

        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            saveRoutine.ExecuteAsync(Routines.WeekdaysCommand(studyCategoryId: "unknown"), CancellationToken.None));

        exception.Message.ShouldContain("\"unknown\"");
        _routines.SaveCount.ShouldBe(0);
    }

    [Fact]
    public async Task ExecuteAsync_RejectsInvalidRoutineWithoutSaving()
    {
        var command = Routines.WeekdaysCommand() with { End = "25:00" };

        await Should.ThrowAsync<DomainRuleException>(() =>
            new SaveRoutine(_routines, _categories).ExecuteAsync(command, CancellationToken.None));

        _routines.SaveCount.ShouldBe(0);
    }
}
