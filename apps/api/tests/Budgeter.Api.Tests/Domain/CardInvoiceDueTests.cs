using Budgeter.Api.Domain.Finances;
using Shouldly;

namespace Budgeter.Api.Tests.Domain;

public class CardInvoiceDueTests
{
    private const long Limit = 500000;
    private static readonly CardTerms Terms = CardTerms.Create(Limit, closingDay: 3, dueDay: 10);
    private static readonly Account Visa = Account.CreateCreditCard("visa", "Visa", Terms);
    private static readonly DateOnly Today = new(2026, 11, 2);
    private static readonly InvoiceCycle Open = Terms.CycleContaining(Today);

    private static IReadOnlyList<CardInvoiceDue> DuesFor(CardSums sums) =>
        CardInvoiceDue.From("visa", Limit, AccountStatement.ForCreditCard(Visa, Terms, Open, sums).Card!);

    [Fact]
    public void From_ListsTheClosedAmountDueAndTheOpenInvoiceWithTheirDueDates()
    {
        var sums = new CardSums(-20000, -30000, -50000, 0);

        var dues = DuesFor(sums);

        dues.ShouldBe([
            new CardInvoiceDue("visa", new DateOnly(2026, 10, 10), 30000, IsClosed: true),
            new CardInvoiceDue("visa", new DateOnly(2026, 11, 10), 20000, IsClosed: false),
        ]);
    }

    [Fact]
    public void From_ADebtPaidOffLeavesNothing()
    {
        var sums = new CardSums(0, -30000, -30000, 30000);

        DuesFor(sums).ShouldBeEmpty();
    }

    [Fact]
    public void From_APartPaymentIntoTheOpenInvoiceLowersWhatIsLeftOfIt()
    {
        var sums = new CardSums(-20000, 0, -20000, 5000);

        DuesFor(sums).Single().AmountCents.ShouldBe(15000);
    }
}
