using Budgeter.Api.Application.Routines;
using Budgeter.Api.Domain;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class DeleteRoutineTests
{
    [Fact]
    public async Task ExecuteAsync_RemovesTheRoutine()
    {
        var routines = new InMemoryRoutineRepository(Routines.Weekdays());

        await new DeleteRoutine(routines).ExecuteAsync("weekdays", CancellationToken.None);

        (await routines.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_IgnoresARoutineAlreadyGone()
    {
        var routines = new InMemoryRoutineRepository();

        await Should.NotThrowAsync(() =>
            new DeleteRoutine(routines).ExecuteAsync("weekdays", CancellationToken.None));
    }

    [Fact]
    public async Task ExecuteAsync_RejectsAMalformedId()
    {
        var exception = await Should.ThrowAsync<DomainRuleException>(() =>
            new DeleteRoutine(new InMemoryRoutineRepository()).ExecuteAsync("has spaces", CancellationToken.None));

        exception.Message.ShouldContain("\"has spaces\"");
    }
}
