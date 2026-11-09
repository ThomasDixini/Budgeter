using Orbit.Api.Application;
using Orbit.Api.Application.Finances;
using Orbit.Api.Domain;
using Orbit.Api.Domain.Finances;
using Orbit.Api.Tests.Fakes;
using Shouldly;

namespace Orbit.Api.Tests.Application;

public class CardPaymentUseCaseTests
{
    private static readonly DateOnly November10 = new(2026, 11, 10);

    private readonly InMemoryAccountRepository _accounts = new(
        Account.CreateBankAccount("checking-account", "Checking account"),
        Account.CreateCreditCard("visa", "Visa", CardTerms.Create(500000, 3, 10)));
    private readonly InMemoryCardPaymentRepository _payments = new();

    private SaveCardPayment SaveCardPayment => new(_payments, _accounts);

    private static SaveCardPaymentCommand PayVisa(string cardId = "visa", string fromAccountId = "checking-account") =>
        new("p1", cardId, fromAccountId, November10, 234690);

    [Fact]
    public async Task Save_StoresThePaymentAndListsItInItsMonth()
    {
        await SaveCardPayment.ExecuteAsync(PayVisa(), CancellationToken.None);

        var november = await new ListCardPayments(_payments).ExecuteAsync("2026-11", CancellationToken.None);
        var october = await new ListCardPayments(_payments).ExecuteAsync("2026-10", CancellationToken.None);

        (november.Single().AmountCents, october.Count).ShouldBe((234690L, 0));
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCard()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveCardPayment.ExecuteAsync(PayVisa(cardId: "amex"), CancellationToken.None));

        exception.Message.ShouldContain("\"amex\"");
    }

    [Fact]
    public async Task Save_RejectsPayingFromACard()
    {
        await Should.ThrowAsync<DomainRuleException>(() =>
            SaveCardPayment.ExecuteAsync(PayVisa(fromAccountId: "visa"), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_RemovesThePaymentAndIgnoresOneAlreadyGone()
    {
        await SaveCardPayment.ExecuteAsync(PayVisa(), CancellationToken.None);
        var deleteCardPayment = new DeleteCardPayment(_payments);

        await deleteCardPayment.ExecuteAsync("p1", CancellationToken.None);
        await deleteCardPayment.ExecuteAsync("p1", CancellationToken.None);

        (await new ListCardPayments(_payments).ExecuteAsync("2026-11", CancellationToken.None)).ShouldBeEmpty();
    }
}
