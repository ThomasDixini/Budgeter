using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Categories;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class CategoryTests
{
    [Fact]
    public void Create_TrimsNameAndUppercasesColor()
    {
        var category = Category.Create("languages", "  Languages ", "#86efac");

        category.Name.ShouldBe("Languages");
        category.Color.ShouldBe("#86EFAC");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A name that is way too long to fit in a category card")]
    public void Create_RejectsNameOutsideLimits(string name)
    {
        var exception = Should.Throw<DomainRuleException>(() => Category.Create("c1", name, "#86EFAC"));

        exception.Message.ShouldContain($"\"{name}\"");
    }

    [Theory]
    [InlineData("blue")]
    [InlineData("#FFF")]
    public void Create_RejectsColorNotShapedLikeHex(string color)
    {
        var exception = Should.Throw<DomainRuleException>(() => Category.Create("c1", "Study", color));

        exception.Message.ShouldContain("#RRGGBB");
    }

    [Theory]
    [InlineData("")]
    [InlineData("has spaces")]
    [InlineData("slash/id")]
    public void Create_RejectsMalformedId(string id)
    {
        Should.Throw<DomainRuleException>(() => Category.Create(id, "Study", "#86EFAC"));
    }
}
