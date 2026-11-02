using Budgeter.Api.Application;
using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class CreateCategoryTests
{
    [Fact]
    public async Task ExecuteAsync_StoresNewCategory()
    {
        var repository = new InMemoryCategoryRepository();
        var createCategory = new CreateCategory(repository);

        var creation = await createCategory.ExecuteAsync(
            new CreateCategoryCommand("languages", "Languages", "#86EFAC"), CancellationToken.None);

        creation.WasCreated.ShouldBeTrue();
        (await repository.FindAsync("languages", CancellationToken.None))!.Name.ShouldBe("Languages");
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsStoredCategoryOnRetry()
    {
        var repository = new InMemoryCategoryRepository(Category.Create("languages", "Languages", "#86EFAC"));
        var createCategory = new CreateCategory(repository);

        var creation = await createCategory.ExecuteAsync(
            new CreateCategoryCommand("languages", " Languages ", "#86efac"), CancellationToken.None);

        creation.WasCreated.ShouldBeFalse();
        creation.Record.Name.ShouldBe("Languages");
        repository.AddCount.ShouldBe(0);
    }

    // Regression: a create reusing an id with other contents silently answered with the old category.
    [Fact]
    public async Task ExecuteAsync_RejectsARetryWithOtherContents()
    {
        var repository = new InMemoryCategoryRepository(Category.Create("languages", "Languages", "#86EFAC"));

        var exception = await Should.ThrowAsync<ConflictException>(() => new CreateCategory(repository)
            .ExecuteAsync(new CreateCategoryCommand("languages", "Renamed", "#7DD3FC"), CancellationToken.None));

        exception.Message.ShouldContain("\"Renamed\"");
        (await repository.FindAsync("languages", CancellationToken.None))!.Name.ShouldBe("Languages");
    }
}
