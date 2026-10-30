using Budgeter.Api.Application;
using Budgeter.Api.Application.Categories;
using Budgeter.Api.Domain.Categories;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class UpdateAndDeleteCategoryTests
{
    private readonly InMemoryCategoryRepository _categories =
        new(Category.Create("languages", "Languages", "#86EFAC"));

    [Fact]
    public async Task Update_RenamesAndRecolorsTheCategory()
    {
        var updated = await new UpdateCategory(_categories).ExecuteAsync(
            new UpdateCategoryCommand("languages", " Spanish ", "#7dd3fc"), CancellationToken.None);

        updated.Name.ShouldBe("Spanish");
        (await _categories.FindAsync("languages", CancellationToken.None))!.Color.ShouldBe("#7DD3FC");
    }

    [Fact]
    public async Task Update_RejectsUnknownCategory()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            new UpdateCategory(_categories).ExecuteAsync(
                new UpdateCategoryCommand("missing", "Name", "#7DD3FC"), CancellationToken.None));

        exception.Message.ShouldContain("\"missing\"");
    }

    [Fact]
    public async Task Delete_RemovesTheCategoryAndIgnoresUnknownIds()
    {
        var deleteCategory = new DeleteCategory(_categories);

        await deleteCategory.ExecuteAsync("languages", CancellationToken.None);
        await deleteCategory.ExecuteAsync("languages", CancellationToken.None);

        (await _categories.ListAsync(CancellationToken.None)).ShouldBeEmpty();
    }
}
