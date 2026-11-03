using System.Globalization;
using Budgeter.Api.Application.Investments;
using Budgeter.Api.Domain.Investments;
using Microsoft.Data.Sqlite;

namespace Budgeter.Api.Infrastructure.Sqlite;

/// <summary>
/// Investments, trades and proventos stored in the <c>investments</c>, <c>investment_trades</c> and
/// <c>investment_incomes</c> tables, dated as <c>YYYY-MM-DD</c> text so date order and text order agree.
/// </summary>
public sealed class SqliteInvestmentRepository(SqliteConnectionFactory connections) : IInvestmentRepository
{
    private const string DateFormat = "yyyy-MM-dd";
    private const string TradeColumns = "id, investment_id, date, kind, quantity_thousandths, unit_price_cents";
    private const string IncomeColumns = "id, investment_id, date, kind, amount_cents";

    public async Task<IReadOnlyList<Investment>> ListAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT id, name, kind, price_cents, priced_on FROM investments ORDER BY rowid",
            ToInvestment,
            cancellationToken);
    }

    public async Task<Investment?> FindAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            "SELECT id, name, kind, price_cents, priced_on FROM investments WHERE id = $id",
            ToInvestment,
            cancellationToken,
            ("$id", id));
        return found.SingleOrDefault();
    }

    public async Task SaveAsync(Investment investment, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        // Not INSERT OR REPLACE: that deletes and re-inserts the row, giving it a new rowid.
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO investments (id, name, kind, price_cents, priced_on)
            VALUES ($id, $name, $kind, $priceCents, $pricedOn)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name, kind = excluded.kind,
                price_cents = excluded.price_cents, priced_on = excluded.priced_on
            """,
            cancellationToken,
            ("$id", investment.Id), ("$name", investment.Name), ("$kind", investment.Kind.ToString()),
            ("$priceCents", investment.Price?.Cents),
            ("$pricedOn", investment.Price is { } price ? ToText(price.On) : null));
    }

    public async Task DeleteAsync(string investmentId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM investments WHERE id = $id", cancellationToken, ("$id", investmentId));
    }

    public async Task<bool> HasActivityAsync(string investmentId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            """
            SELECT EXISTS (SELECT 1 FROM investment_trades WHERE investment_id = $id)
                OR EXISTS (SELECT 1 FROM investment_incomes WHERE investment_id = $id)
            """,
            reader => reader.GetBoolean(0),
            cancellationToken,
            ("$id", investmentId));
        return found[0];
    }

    public async Task<IReadOnlyList<InvestmentTrade>> ListTradesAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {TradeColumns} FROM investment_trades ORDER BY date, rowid",
            ToTrade,
            cancellationToken);
    }

    public async Task<InvestmentTrade?> FindTradeAsync(string id, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        var found = await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {TradeColumns} FROM investment_trades WHERE id = $id",
            ToTrade,
            cancellationToken,
            ("$id", id));
        return found.SingleOrDefault();
    }

    public async Task SaveTradeAsync(InvestmentTrade trade, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO investment_trades (id, investment_id, date, kind, quantity_thousandths, unit_price_cents)
            VALUES ($id, $investmentId, $date, $kind, $quantity, $unitPrice)
            ON CONFLICT (id) DO UPDATE SET
                investment_id = excluded.investment_id, date = excluded.date, kind = excluded.kind,
                quantity_thousandths = excluded.quantity_thousandths, unit_price_cents = excluded.unit_price_cents
            """,
            cancellationToken,
            ("$id", trade.Id), ("$investmentId", trade.InvestmentId), ("$date", ToText(trade.Date)),
            ("$kind", trade.Kind.ToString()), ("$quantity", trade.QuantityThousandths), ("$unitPrice", trade.UnitPriceCents));
    }

    public async Task DeleteTradeAsync(string tradeId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM investment_trades WHERE id = $id", cancellationToken, ("$id", tradeId));
    }

    public async Task<IReadOnlyList<InvestmentIncome>> ListIncomesAsync(CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        return await SqliteCommands.QueryAsync(
            lease.Connection,
            $"SELECT {IncomeColumns} FROM investment_incomes ORDER BY date DESC, rowid DESC",
            ToIncome,
            cancellationToken);
    }

    public async Task SaveIncomeAsync(InvestmentIncome income, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection,
            """
            INSERT INTO investment_incomes (id, investment_id, date, kind, amount_cents)
            VALUES ($id, $investmentId, $date, $kind, $amountCents)
            ON CONFLICT (id) DO UPDATE SET
                investment_id = excluded.investment_id, date = excluded.date, kind = excluded.kind,
                amount_cents = excluded.amount_cents
            """,
            cancellationToken,
            ("$id", income.Id), ("$investmentId", income.InvestmentId), ("$date", ToText(income.Date)),
            ("$kind", income.Kind.ToString()), ("$amountCents", income.AmountCents));
    }

    public async Task DeleteIncomeAsync(string incomeId, CancellationToken cancellationToken)
    {
        await using var lease = await connections.LeaseAsync(cancellationToken);
        await SqliteCommands.ExecuteAsync(
            lease.Connection, "DELETE FROM investment_incomes WHERE id = $id", cancellationToken, ("$id", incomeId));
    }

    private static Investment ToInvestment(SqliteDataReader reader)
    {
        var price = reader.IsDBNull(3) ? null : PricePoint.Restore(reader.GetInt64(3), ToDay(reader.GetString(4)));
        return Investment.Restore(
            reader.GetString(0), reader.GetString(1), Enum.Parse<InvestmentKind>(reader.GetString(2)), price);
    }

    private static InvestmentTrade ToTrade(SqliteDataReader reader)
    {
        return InvestmentTrade.Restore(
            reader.GetString(0), reader.GetString(1), ToDay(reader.GetString(2)),
            Enum.Parse<TradeKind>(reader.GetString(3)), reader.GetInt64(4), reader.GetInt64(5));
    }

    private static InvestmentIncome ToIncome(SqliteDataReader reader)
    {
        return InvestmentIncome.Restore(
            reader.GetString(0), reader.GetString(1), ToDay(reader.GetString(2)),
            Enum.Parse<IncomeKind>(reader.GetString(3)), reader.GetInt64(4));
    }

    private static DateOnly ToDay(string text) => DateOnly.ParseExact(text, DateFormat, CultureInfo.InvariantCulture);

    private static string ToText(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);
}
