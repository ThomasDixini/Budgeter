using Orbit.Api.Application.Finances;
using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Tests.Fakes;

/// <summary>Card payment storage kept in a list (in creation order), for use case tests.</summary>
internal sealed class InMemoryCardPaymentRepository : ICardPaymentRepository
{
    private readonly List<CardPayment> _payments = [];

    public Task<IReadOnlyList<CardPayment>> ListInMonthAsync(TransactionMonth month, CancellationToken cancellationToken)
    {
        var inMonth = _payments
            .Select((payment, position) => (payment, position))
            .Where(entry => entry.payment.Date >= month.FirstDay && entry.payment.Date < month.NextFirstDay)
            .OrderByDescending(entry => entry.payment.Date)
            .ThenByDescending(entry => entry.position)
            .Select(entry => entry.payment);
        return Task.FromResult<IReadOnlyList<CardPayment>>(inMonth.ToList());
    }

    public Task SaveAsync(CardPayment payment, CancellationToken cancellationToken)
    {
        var index = _payments.FindIndex(stored => stored.Id == payment.Id);
        if (index < 0) _payments.Add(payment);
        else _payments[index] = payment;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string paymentId, CancellationToken cancellationToken)
    {
        _payments.RemoveAll(payment => payment.Id == paymentId);
        return Task.CompletedTask;
    }

    public Task<long> SumPaidFromAsync(string accountId, DateOnly until, CancellationToken cancellationToken)
    {
        return Task.FromResult(SumBefore(until, payment => payment.FromAccountId == accountId));
    }

    public Task<long> SumPaidToAsync(string cardId, DateOnly until, CancellationToken cancellationToken)
    {
        return Task.FromResult(SumBefore(until, payment => payment.CardId == cardId));
    }

    public Task<bool> AnyForAccountAsync(string accountId, CancellationToken cancellationToken)
    {
        return Task.FromResult(
            _payments.Exists(payment => payment.CardId == accountId || payment.FromAccountId == accountId));
    }

    private long SumBefore(DateOnly until, Func<CardPayment, bool> involves) =>
        _payments.Where(payment => involves(payment) && payment.Date < until).Sum(payment => payment.AmountCents);
}
