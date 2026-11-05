using Budgeter.Api.Application;
using Budgeter.Api.Application.Finances;
using Budgeter.Api.Domain;
using Budgeter.Api.Domain.Finances;
using Budgeter.Api.Tests.Fakes;
using Shouldly;

namespace Budgeter.Api.Tests.Application;

public class BillUseCaseTests
{
    private static readonly DateOnly November5 = new(2026, 11, 5);
    private static readonly DateOnly Today = new(2026, 11, 3);

    private readonly InMemoryBillRepository _bills = new();
    private readonly InMemoryFinanceCategoryRepository _categories = new(FinanceCategory.Create("housing", "Housing"));
    private readonly InMemoryAccountRepository _accounts = new(
        Account.CreateBankAccount("checking-account", "Checking account"),
        Account.CreateCreditCard("visa", "Visa", CardTerms.Create(500000, 3, 10)));
    private readonly InMemoryMoneyTransactionRepository _transactions = new();
    private readonly InMemoryCardPaymentRepository _payments = new();
    private readonly ImmediateUnitOfWork _unitOfWork = new();

    private SaveBill SaveBill => new(_bills, _categories, _unitOfWork);
    private SaveTransaction SaveTransaction => new(_transactions, _categories, _accounts);
    private SettleBill SettleBill => new(_bills, SaveTransaction, _unitOfWork);
    private ReopenBill ReopenBill => new(_bills, new DeleteTransaction(_transactions), _unitOfWork);

    private ListBillsAgenda Agenda =>
        new(_bills, _accounts, new ListAccountStatements(_accounts, _transactions, _payments));

    private static SaveBillCommand Rent(
        string id = "b1", string categoryId = "housing", BillRecurrenceCommand? recurrence = null,
        BillKind kind = BillKind.Payable, long amountCents = 150000) =>
        new(id, kind, "Rent", categoryId, amountCents, November5, recurrence);

    private Task<IReadOnlyList<MoneyTransaction>> NovemberTransactions() =>
        _transactions.ListInMonthAsync(TransactionMonth.Parse("2026-11"), CancellationToken.None);

    [Fact]
    public async Task Save_StoresASingleBill()
    {
        var saved = await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);

        (await _bills.FindAsync("b1", CancellationToken.None)).ShouldBeSameAs(saved.Single());
    }

    [Fact]
    public async Task Save_SpreadsARecurringBillIntoItsOccurrences()
    {
        var saved = await SaveBill.ExecuteAsync(
            Rent(recurrence: new BillRecurrenceCommand(BillRecurrence.Monthly, 3)), CancellationToken.None);

        saved.Select(bill => bill.Id).ShouldBe(["b1", "b1-2", "b1-3"]);
        (await _bills.FindAsync("b1-3", CancellationToken.None)).ShouldNotBeNull();
    }

    [Fact]
    public async Task Save_RepeatingARecurringCreationLeavesOneSeries()
    {
        var command = Rent(recurrence: new BillRecurrenceCommand(BillRecurrence.Monthly, 3));

        await SaveBill.ExecuteAsync(command, CancellationToken.None);
        await SaveBill.ExecuteAsync(command, CancellationToken.None);

        var open = await _bills.ListOpenDueBeforeAsync(DateOnly.MaxValue, CancellationToken.None);
        open.Count.ShouldBe(3);
    }

    [Fact]
    public async Task Save_EditsOnlyThatOccurrenceAndKeepsItsPlaceInTheSeries()
    {
        await SaveBill.ExecuteAsync(
            Rent(recurrence: new BillRecurrenceCommand(BillRecurrence.Monthly, 3)), CancellationToken.None);

        await SaveBill.ExecuteAsync(Rent(id: "b1-2", amountCents: 160000), CancellationToken.None);

        var edited = await _bills.FindAsync("b1-2", CancellationToken.None);
        (edited!.AmountCents, edited.Series!.Number).ShouldBe((160000L, 2));
    }

    [Fact]
    public async Task Save_RejectsAnUnknownCategory()
    {
        var exception = await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SaveBill.ExecuteAsync(Rent(categoryId: "missing"), CancellationToken.None));

        exception.Message.ShouldContain("\"missing\"");
    }

    [Fact]
    public async Task Save_RejectsEditingASettledBill()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);
        await SettleBill.ExecuteAsync(new SettleBillCommand("b1", Today, "checking-account"), CancellationToken.None);

        await Should.ThrowAsync<ConflictException>(() =>
            SaveBill.ExecuteAsync(Rent(amountCents: 1), CancellationToken.None));
    }

    [Fact]
    public async Task Settle_ARecordsAPayableAsAnExpenseWithTheBillsId()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);

        var settled = await SettleBill.ExecuteAsync(new SettleBillCommand("b1", Today, "checking-account"), CancellationToken.None);

        var transaction = (await NovemberTransactions()).Single();
        (settled.IsSettled, transaction.Id, transaction.AmountCents, transaction.AccountId, transaction.Date)
            .ShouldBe((true, "b1", -150000L, "checking-account", Today));
    }

    [Fact]
    public async Task Settle_AReceivableBecomesIncome()
    {
        await SaveBill.ExecuteAsync(Rent(kind: BillKind.Receivable), CancellationToken.None);

        await SettleBill.ExecuteAsync(new SettleBillCommand("b1", Today, "checking-account"), CancellationToken.None);

        (await NovemberTransactions()).Single().AmountCents.ShouldBe(150000);
    }

    [Fact]
    public async Task Settle_TwiceTheSameWayLeavesASingleTransaction()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);
        var command = new SettleBillCommand("b1", Today, "checking-account");

        await SettleBill.ExecuteAsync(command, CancellationToken.None);
        await SettleBill.ExecuteAsync(command, CancellationToken.None);

        (await NovemberTransactions()).Count.ShouldBe(1);
    }

    [Fact]
    public async Task Settle_RejectsAnUnknownBillAndAnUnknownAccount()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);

        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SettleBill.ExecuteAsync(new SettleBillCommand("nope", Today, "checking-account"), CancellationToken.None));
        await Should.ThrowAsync<ResourceNotFoundException>(() =>
            SettleBill.ExecuteAsync(new SettleBillCommand("b1", Today, "wallet"), CancellationToken.None));
    }

    [Fact]
    public async Task Reopen_RemovesTheTransactionAndToleratesAnOpenBill()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);
        await SettleBill.ExecuteAsync(new SettleBillCommand("b1", Today, "checking-account"), CancellationToken.None);

        var reopened = await ReopenBill.ExecuteAsync("b1", CancellationToken.None);
        await ReopenBill.ExecuteAsync("b1", CancellationToken.None);

        (reopened.IsSettled, (await NovemberTransactions()).Count).ShouldBe((false, 0));
    }

    [Fact]
    public async Task Delete_RemovesTheBillAndIgnoresOneAlreadyGone()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);
        var delete = new DeleteBill(_bills);

        await delete.ExecuteAsync("b1", CancellationToken.None);
        await delete.ExecuteAsync("b1", CancellationToken.None);

        (await _bills.FindAsync("b1", CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task Agenda_HoldsOpenBillsWithinTheHorizonAndRecentlySettledOnes()
    {
        await SaveBill.ExecuteAsync(Rent(id: "soon"), CancellationToken.None);
        await SaveBill.ExecuteAsync(
            Rent(id: "far") with { DueDate = Today.AddDays(ListBillsAgenda.HorizonDays + 1) }, CancellationToken.None);
        await SaveBill.ExecuteAsync(Rent(id: "paid"), CancellationToken.None);
        await SettleBill.ExecuteAsync(new SettleBillCommand("paid", Today, "checking-account"), CancellationToken.None);

        var agenda = await Agenda.ExecuteAsync(Today, CancellationToken.None);

        agenda.Bills.Select(bill => bill.Id).ShouldBe(["soon", "paid"]);
    }

    [Fact]
    public async Task Agenda_ListsCardInvoicesStillToBePaid()
    {
        await SaveTransaction.ExecuteAsync(
            new SaveTransactionCommand("t1", new DateOnly(2026, 10, 20), "Groceries", "housing", "visa", -30000),
            CancellationToken.None);

        var agenda = await Agenda.ExecuteAsync(Today, CancellationToken.None);

        agenda.CardInvoices.ShouldBe([new CardInvoiceDue("visa", new DateOnly(2026, 11, 10), 30000, IsClosed: true)]);
    }

    [Fact]
    public async Task DeleteCategory_KeepsACategoryThatHasBills()
    {
        await SaveBill.ExecuteAsync(Rent(), CancellationToken.None);
        var deleteCategory = new DeleteFinanceCategory(_categories, _transactions, _bills);

        await Should.ThrowAsync<ConflictException>(() => deleteCategory.ExecuteAsync("housing", CancellationToken.None));
    }
}
