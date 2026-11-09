using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Endpoints;

/// <summary>How a new bill repeats; sent only when it is created.</summary>
public sealed record BillRecurrenceBody(BillRecurrence Kind, int Count)
{
    public BillRecurrenceCommand ToCommand() => new(Kind, Count);
}

/// <summary>Body of <c>PUT /bills/{billId}</c>; the id comes from the route.</summary>
public sealed record SaveBillRequest(
    BillKind Kind, string Description, string CategoryId, long AmountCents, DateOnly DueDate,
    BillRecurrenceBody? Recurrence = null)
{
    public SaveBillCommand ToCommand(string billId) =>
        new(billId, Kind, Description, CategoryId, AmountCents, DueDate, Recurrence?.ToCommand());
}

/// <summary>Body of <c>PUT /bills/{billId}/settlement</c>.</summary>
public sealed record SettleBillRequest(DateOnly Date, string AccountId)
{
    public SettleBillCommand ToCommand(string billId) => new(billId, Date, AccountId);
}

public sealed record BillSettlementBody(DateOnly Date, string AccountId)
{
    public static BillSettlementBody? From(BillSettlement? settlement) =>
        settlement is null ? null : new(settlement.Date, settlement.AccountId);
}

public sealed record BillSeriesBody(string SeriesId, BillRecurrence Recurrence, int Number, int Count)
{
    public static BillSeriesBody? From(BillSeries? series) =>
        series is null ? null : new(series.SeriesId, series.Recurrence, series.Number, series.Count);
}

public sealed record BillResponse(
    string Id, BillKind Kind, string Description, string CategoryId, long AmountCents, DateOnly DueDate,
    BillSettlementBody? Settlement, BillSeriesBody? Series)
{
    public static BillResponse From(Bill bill) =>
        new(bill.Id, bill.Kind, bill.Description, bill.CategoryId, bill.AmountCents, bill.DueDate,
            BillSettlementBody.From(bill.Settlement), BillSeriesBody.From(bill.Series));
}

public sealed record CardInvoiceDueResponse(string CardId, DateOnly DueOn, long AmountCents, bool IsClosed)
{
    public static CardInvoiceDueResponse From(CardInvoiceDue due) =>
        new(due.CardId, due.DueOn, due.AmountCents, due.IsClosed);
}

public sealed record BillsAgendaResponse(
    IReadOnlyList<BillResponse> Bills, IReadOnlyList<CardInvoiceDueResponse> CardInvoices)
{
    public static BillsAgendaResponse From(BillsAgenda agenda) =>
        new(agenda.Bills.Select(BillResponse.From).ToList(),
            agenda.CardInvoices.Select(CardInvoiceDueResponse.From).ToList());
}

/// <summary>HTTP routes for the bills to pay and to receive.</summary>
public static class BillEndpoints
{
    /// <summary>
    /// Maps <c>GET /bills?date=YYYY-MM-DD</c>, <c>PUT</c>/<c>DELETE /bills/{billId}</c> and
    /// <c>PUT</c>/<c>DELETE /bills/{billId}/settlement</c>.
    /// </summary>
    /// <example><code>app.MapBillEndpoints();</code></example>
    public static IEndpointRouteBuilder MapBillEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/bills", ListAsync);
        routes.MapPut("/bills/{billId}", SaveAsync);
        routes.MapDelete("/bills/{billId}", DeleteAsync);
        routes.MapPut("/bills/{billId}/settlement", SettleAsync);
        routes.MapDelete("/bills/{billId}/settlement", ReopenAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        DateOnly date, ListBillsAgenda listBillsAgenda, CancellationToken cancellationToken)
    {
        var agenda = await listBillsAgenda.ExecuteAsync(date, cancellationToken);
        return Results.Ok(BillsAgendaResponse.From(agenda));
    }

    private static async Task<IResult> SaveAsync(
        string billId, SaveBillRequest request, SaveBill saveBill, CancellationToken cancellationToken)
    {
        var saved = await saveBill.ExecuteAsync(request.ToCommand(billId), cancellationToken);
        return Results.Ok(saved.Select(BillResponse.From));
    }

    private static async Task<IResult> DeleteAsync(
        string billId, DeleteBill deleteBill, CancellationToken cancellationToken)
    {
        await deleteBill.ExecuteAsync(billId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SettleAsync(
        string billId, SettleBillRequest request, SettleBill settleBill, CancellationToken cancellationToken)
    {
        var settled = await settleBill.ExecuteAsync(request.ToCommand(billId), cancellationToken);
        return Results.Ok(BillResponse.From(settled));
    }

    private static async Task<IResult> ReopenAsync(
        string billId, ReopenBill reopenBill, CancellationToken cancellationToken)
    {
        var reopened = await reopenBill.ExecuteAsync(billId, cancellationToken);
        return Results.Ok(BillResponse.From(reopened));
    }
}
