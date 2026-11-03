namespace Budgeter.Api.Domain.Finances;

/// <summary>
/// How the monthly income is meant to be shared: a base income and parts that each take a percentage of
/// it and spend on their own finance categories. A category belongs to at most one part, so what was
/// spent is never counted twice. The percentages are not forced to add up to 100: the plan can be built
/// step by step, and the screen shows what is left over or past the total.
/// </summary>
public sealed class IncomeSplit
{
    public const int MaxParts = 12;

    public long BaseIncomeCents { get; }
    public IReadOnlyList<IncomeSplitPart> Parts { get; }

    private IncomeSplit(long baseIncomeCents, IReadOnlyList<IncomeSplitPart> parts)
    {
        BaseIncomeCents = baseIncomeCents;
        Parts = parts;
    }

    /// <summary>The plan nothing was saved for yet: no income and no parts.</summary>
    public static IncomeSplit Empty { get; } = new(0, []);

    /// <summary>
    /// Builds a valid plan: an income from 0 to the amount limit, at most 12 parts with distinct ids, and
    /// no category in two parts.
    /// </summary>
    /// <example><code>IncomeSplit.Create(950000, [IncomeSplitPart.Create("fixed", "Fixed costs", 50, 0, ["housing"])]).Parts.Count; // 1</code></example>
    public static IncomeSplit Create(long baseIncomeCents, IReadOnlyList<IncomeSplitPart> parts)
    {
        RequireIncome(baseIncomeCents);
        RequirePartCount(parts);
        RequireDistinct(parts.Select(part => part.Id), "part id");
        RequireDistinct(parts.SelectMany(part => part.CategoryIds), "category id across parts");
        return new IncomeSplit(baseIncomeCents, parts);
    }

    /// <summary>
    /// Rebuilds a stored plan as it was saved, without today's rules.
    /// </summary>
    /// <example><code>IncomeSplit.Restore(950000, storedParts);</code></example>
    internal static IncomeSplit Restore(long baseIncomeCents, IReadOnlyList<IncomeSplitPart> parts) =>
        new(baseIncomeCents, parts);

    private static void RequireIncome(long baseIncomeCents)
    {
        if (baseIncomeCents is >= 0 and <= MoneyTransaction.MaxAbsoluteAmountCents) return;
        throw new DomainRuleException(
            $"Expected the base income to be a number of cents from 0 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {baseIncomeCents}");
    }

    private static void RequirePartCount(IReadOnlyList<IncomeSplitPart> parts)
    {
        if (parts.Count <= MaxParts) return;
        throw new DomainRuleException($"Expected at most {MaxParts} income split parts, received {parts.Count}");
    }

    private static void RequireDistinct(IEnumerable<string> ids, string description)
    {
        var repeated = ids.GroupBy(id => id).FirstOrDefault(group => group.Count() > 1);
        if (repeated is null) return;
        throw new DomainRuleException(
            $"Expected each {description} to appear once, received {ReceivedValue.Quote(repeated.Key)} more than once");
    }
}
