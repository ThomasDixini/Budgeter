using Orbit.Api.Domain.Finances;

namespace Orbit.Api.Application.Finances;

/// <summary>Port to the storage of credit card invoice payments.</summary>
public interface ICardPaymentRepository
{
    /// <summary>The payments dated in the month, newest day first and, within a day, the latest recorded first.</summary>
    Task<IReadOnlyList<CardPayment>> ListInMonthAsync(TransactionMonth month, CancellationToken cancellationToken);

    /// <summary>Stores the payment, replacing a stored one with the same id.</summary>
    Task SaveAsync(CardPayment payment, CancellationToken cancellationToken);

    /// <summary>Removes the payment; an unknown id is ignored.</summary>
    Task DeleteAsync(string paymentId, CancellationToken cancellationToken);

    /// <summary>What was paid from the bank account on days before <paramref name="until"/>; zero when nothing was.</summary>
    Task<long> SumPaidFromAsync(string accountId, DateOnly until, CancellationToken cancellationToken);

    /// <summary>What was paid to the card on days before <paramref name="until"/>; zero when nothing was.</summary>
    Task<long> SumPaidToAsync(string cardId, DateOnly until, CancellationToken cancellationToken);

    /// <summary>Whether any payment was made from or to the account.</summary>
    Task<bool> AnyForAccountAsync(string accountId, CancellationToken cancellationToken);
}
