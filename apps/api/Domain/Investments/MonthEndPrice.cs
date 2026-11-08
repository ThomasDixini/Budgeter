using System.Text.RegularExpressions;

namespace Budgeter.Api.Domain.Investments;

/// <summary>The closing price, in cents, of one unit of a traded symbol in a month (<c>YYYY-MM</c>).</summary>
public sealed record MonthEndPrice(string Symbol, string Month, long Cents);

/// <summary>
/// Which investments have a market quote that can be looked up. Only stocks and real estate funds listed
/// on B3 do, and the symbol is the name the user gave them (PETR4, HGLG11); anything else is not looked up.
/// </summary>
public static partial class QuoteSymbol
{
    [GeneratedRegex(@"^[A-Z]{4}\d{1,2}$")]
    private static partial Regex B3Ticker();

    /// <summary>
    /// The symbol to ask quotes for, or null when the investment has none.
    /// </summary>
    /// <example><code>QuoteSymbol.For(Investment.Create("a", " petr4 ", InvestmentKind.Stock, null)); // "PETR4"</code></example>
    public static string? For(Investment investment)
    {
        if (investment.Kind is not (InvestmentKind.Stock or InvestmentKind.RealEstateFund)) return null;
        var symbol = investment.Name.Trim().ToUpperInvariant();
        return B3Ticker().IsMatch(symbol) ? symbol : null;
    }
}
