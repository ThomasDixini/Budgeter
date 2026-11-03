using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class AccountStatementTests
{
    private static readonly CardTerms Terms = CardTerms.Create(500000, closingDay: 3, dueDay: 10);
    private static readonly Account Visa = Account.CreateCreditCard("visa", "Visa", Terms);
    private static readonly InvoiceCycle Open = Terms.CycleContaining(new DateOnly(2026, 11, 2));

    [Fact]
    public void BankAccount_HoldsItsOpeningBalancePlusTransactionsMinusCardPayments()
    {
        var checking = Account.CreateBankAccount("checking-account", "Checking account", openingBalanceCents: 100000);

        var statement = AccountStatement.ForBankAccount(checking, transactionsCents: 50000, paidOutCents: 30000);

        (statement.BalanceCents, statement.Card).ShouldBe((120000L, null));
    }

    [Fact]
    public void CreditCard_OwesItsPurchasesLessRefundsAndPayments()
    {
        var sums = new CardSums(OpenInvoiceCents: -20000, ClosedInvoiceCents: -30000, AllTransactionsCents: -50000, PaidCents: 30000);

        var statement = AccountStatement.ForCreditCard(Visa, Terms, Open, sums);

        (statement.BalanceCents, statement.Card!.AvailableLimitCents).ShouldBe((-20000L, 480000L));
    }

    [Fact]
    public void CreditCard_SpentOnTheOpenInvoiceIsNotDueYet()
    {
        var sums = new CardSums(OpenInvoiceCents: -20000, ClosedInvoiceCents: -30000, AllTransactionsCents: -50000, PaidCents: 0);

        var card = AccountStatement.ForCreditCard(Visa, Terms, Open, sums).Card!;

        (card.OpenInvoice.AmountCents, card.ClosedInvoice.AmountCents, card.AmountDueCents).ShouldBe((20000L, 30000L, 30000L));
    }

    [Fact]
    public void CreditCard_APaymentSettlesTheClosedInvoiceFirst()
    {
        var sums = new CardSums(OpenInvoiceCents: -20000, ClosedInvoiceCents: -30000, AllTransactionsCents: -50000, PaidCents: 10000);

        AccountStatement.ForCreditCard(Visa, Terms, Open, sums).Card!.AmountDueCents.ShouldBe(20000);
    }

    [Fact]
    public void CreditCard_PayingAheadLeavesNothingDue()
    {
        var sums = new CardSums(OpenInvoiceCents: -20000, ClosedInvoiceCents: -30000, AllTransactionsCents: -50000, PaidCents: 60000);

        var statement = AccountStatement.ForCreditCard(Visa, Terms, Open, sums);

        (statement.BalanceCents, statement.Card!.AmountDueCents).ShouldBe((10000L, 0L));
    }

    [Fact]
    public void CreditCard_ReportsBothInvoicesCycles()
    {
        var card = AccountStatement.ForCreditCard(Visa, Terms, Open, new CardSums(0, 0, 0, 0)).Card!;

        (card.OpenInvoice.Cycle, card.ClosedInvoice.Cycle).ShouldBe((Open, Terms.CycleBefore(Open)));
    }
}
