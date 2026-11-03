using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain.Finances;

namespace Budgeter.Api.Endpoints;

/// <summary>Body of <c>PUT /card-payments/{paymentId}</c>; the id comes from the route.</summary>
public sealed record SaveCardPaymentRequest(string CardId, string FromAccountId, DateOnly Date, long AmountCents)
{
    public SaveCardPaymentCommand ToCommand(string paymentId) => new(paymentId, CardId, FromAccountId, Date, AmountCents);
}

public sealed record CardPaymentResponse(string Id, string CardId, string FromAccountId, DateOnly Date, long AmountCents)
{
    public static CardPaymentResponse From(CardPayment payment) =>
        new(payment.Id, payment.CardId, payment.FromAccountId, payment.Date, payment.AmountCents);
}

/// <summary>HTTP routes for credit card invoice payments.</summary>
public static class CardPaymentEndpoints
{
    /// <summary>
    /// Maps <c>GET /card-payments?month=YYYY-MM</c> and <c>PUT</c>/<c>DELETE /card-payments/{paymentId}</c>.
    /// </summary>
    /// <example><code>app.MapCardPaymentEndpoints();</code></example>
    public static IEndpointRouteBuilder MapCardPaymentEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/card-payments", ListAsync);
        routes.MapPut("/card-payments/{paymentId}", SaveAsync);
        routes.MapDelete("/card-payments/{paymentId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(
        string month, ListCardPayments listCardPayments, CancellationToken cancellationToken)
    {
        var payments = await listCardPayments.ExecuteAsync(month, cancellationToken);
        return Results.Ok(payments.Select(CardPaymentResponse.From));
    }

    private static async Task<IResult> SaveAsync(
        string paymentId, SaveCardPaymentRequest request, SaveCardPayment saveCardPayment,
        CancellationToken cancellationToken)
    {
        var payment = await saveCardPayment.ExecuteAsync(request.ToCommand(paymentId), cancellationToken);
        return Results.Ok(CardPaymentResponse.From(payment));
    }

    private static async Task<IResult> DeleteAsync(
        string paymentId, DeleteCardPayment deleteCardPayment, CancellationToken cancellationToken)
    {
        await deleteCardPayment.ExecuteAsync(paymentId, cancellationToken);
        return Results.NoContent();
    }
}
