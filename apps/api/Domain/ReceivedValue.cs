namespace Orbit.Api.Domain;

/// <summary>
/// Quotes a rejected value for an error message. Long values are cut short: the message is logged and
/// sent back in the response, so a huge field must not flood either of them.
/// </summary>
public static class ReceivedValue
{
    private const int MaxShownLength = 80;

    /// <summary>
    /// The value in quotes, or its first characters and its length when it is too long to show whole.
    /// </summary>
    /// <example><code>ReceivedValue.Quote("blue"); // "\"blue\""</code></example>
    public static string Quote(string value)
    {
        if (value.Length <= MaxShownLength) return $"\"{value}\"";
        return $"\"{value[..MaxShownLength]}…\" ({value.Length} characters)";
    }
}
