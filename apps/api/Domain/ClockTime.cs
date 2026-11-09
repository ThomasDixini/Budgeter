using System.Text.RegularExpressions;

namespace Orbit.Api.Domain;

/// <summary>Validates times of day exchanged as <c>HH:mm</c>, the shape of an HTML time input.</summary>
public static partial class ClockTime
{
    /// <summary>
    /// Returns the time when it is shaped like <c>HH:mm</c> (00:00–23:59); throws otherwise.
    /// </summary>
    /// <example><code>ClockTime.Require("13:30", "block start"); // "13:30"</code></example>
    public static string Require(string clock, string description)
    {
        if (!ClockPattern().IsMatch(clock))
        {
            throw new DomainRuleException(
                $"Expected the {description} to be a time shaped like HH:mm, received {ReceivedValue.Quote(clock)}");
        }
        return clock;
    }

    // \z, not $: in .NET "$" also matches before a final newline, which would let "13:30\n" through.
    [GeneratedRegex(@"^([01][0-9]|2[0-3]):[0-5][0-9]\z")]
    private static partial Regex ClockPattern();
}
