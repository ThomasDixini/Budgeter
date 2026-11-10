using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

public sealed record IncomeSplitPartCommand(
    string Id, string Name, int Percent, int Color, IReadOnlyList<string> CategoryIds);

public sealed record SaveIncomeSplitCommand(long BaseIncomeCents, IReadOnlyList<IncomeSplitPartCommand> Parts);

/// <summary>Replaces the income split plan; saving the same plan twice leaves the same state.</summary>
public sealed class SaveIncomeSplit(IIncomeSplitRepository plans, IFinanceCategoryRepository categories)
{
    /// <summary>
    /// Validates the plan, checks every category exists and stores it over the previous one.
    /// </summary>
    /// <example><code>await saveIncomeSplit.ExecuteAsync(new SaveIncomeSplitCommand(950000, parts), ct);</code></example>
    public async Task<IncomeSplit> ExecuteAsync(SaveIncomeSplitCommand command, CancellationToken cancellationToken)
    {
        var plan = IncomeSplit.Create(command.BaseIncomeCents, command.Parts.Select(ToPart).ToList());
        await RequireCategoriesAsync(plan, cancellationToken);
        await plans.ReplaceAsync(plan, cancellationToken);
        return plan;
    }

    private static IncomeSplitPart ToPart(IncomeSplitPartCommand part) =>
        IncomeSplitPart.Create(part.Id, part.Name, part.Percent, part.Color, part.CategoryIds);

    private async Task RequireCategoriesAsync(IncomeSplit plan, CancellationToken cancellationToken)
    {
        var known = (await categories.ListAsync(cancellationToken)).Select(category => category.Id).ToHashSet();
        var unknown = plan.Parts.SelectMany(part => part.CategoryIds).FirstOrDefault(id => !known.Contains(id));
        if (unknown is not null) throw ResourceNotFoundException.For("finance category", unknown);
    }
}
