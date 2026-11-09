using System.Globalization;
using System.Text.RegularExpressions;

namespace Orbit.Api.Domain.Finances;

/// <summary>A calendar month, the span the transactions list is read by.</summary>
public sealed partial record TransactionMonth
{
    public DateOnly FirstDay { get; }

    private TransactionMonth(DateOnly firstDay)
    {
        FirstDay = firstDay;
    }

    /// <summary>The first day of the following month, the end of this one's range (exclusive).</summary>
    public DateOnly NextFirstDay => FirstDay.AddMonths(1);

    /// <summary>
    /// Reads a month written as <c>YYYY-MM</c>; throws on any other shape.
    /// </summary>
    /// <example><code>TransactionMonth.Parse("2026-10").FirstDay; // 2026-10-01</code></example>
    public static TransactionMonth Parse(string text)
    {
        if (!MonthPattern().IsMatch(text))
        {
            throw new DomainRuleException(
                $"Expected a month shaped like YYYY-MM (e.g. 2026-10), received {ReceivedValue.Quote(text)}");
        }
        var year = int.Parse(text[..4], CultureInfo.InvariantCulture);
        var month = int.Parse(text[5..], CultureInfo.InvariantCulture);
        return new TransactionMonth(new DateOnly(year, month, 1));
    }

    // \z, not $: in .NET "$" also matches before a final newline.
    [GeneratedRegex(@"^(?!0000)\d{4}-(0[1-9]|1[0-2])\z")]
    private static partial Regex MonthPattern();
}
