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
            new CreateCategoryCommand("languages", "Renamed", "#7DD3FC"), CancellationToken.None);

        creation.WasCreated.ShouldBeFalse();
        creation.Record.Name.ShouldBe("Languages");
        repository.AddCount.ShouldBe(0);
    }
}
