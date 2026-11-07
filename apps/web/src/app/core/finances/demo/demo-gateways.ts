import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { CardPayment, AccountStatement } from '../account-statement';
import { AccountStatementsGateway } from '../account-statements-gateway';
import { Bill, BillDraft, BillSettlement, BillsAgenda } from '../bills';
import { BillsGateway } from '../bills-gateway';
import { Account, FinanceCategory } from '../finance-references';
import { IncomeSplit } from '../income-split';
import { IncomeSplitGateway } from '../income-split-gateway';
import {
  Income,
  IncomeDraft,
  Investment,
  InvestmentDraft,
  Portfolio,
  Trade,
  TradeDraft,
} from '../investments';
import { InvestmentsGateway } from '../investments-gateway';
import { Transaction } from '../transaction';
import { FinanceReferencesGateway, TransactionsGateway } from '../transactions-gateway';
import { DemoFinances } from './demo-finances';

/** Replaces the record with the same id, or adds it at the end. */
function upsert<TRecord extends { readonly id: string }>(
  list: readonly TRecord[],
  record: TRecord,
): TRecord[] {
  return list.some((item) => item.id === record.id)
    ? list.map((item) => (item.id === record.id ? record : item))
    : [...list, record];
}

function refused(message: string): Observable<never> {
  return throwError(() => new Error(message));
}

/** Transactions kept in memory by the demo. */
@Injectable()
export class DemoTransactionsGateway extends TransactionsGateway {
  private readonly demo = inject(DemoFinances);

  override listMonth(month: string): Observable<readonly Transaction[]> {
    return of(this.demo.transactionsIn(month));
  }

  override save(transaction: Transaction): Observable<Transaction> {
    this.demo.transactions = upsert(this.demo.transactions, transaction);
    return of(transaction);
  }

  override delete(transactionId: string): Observable<void> {
    this.demo.transactions = this.demo.transactions.filter((item) => item.id !== transactionId);
    return of(undefined);
  }
}

/** Categories and accounts kept in memory by the demo; one something was recorded under cannot be deleted. */
@Injectable()
export class DemoFinanceReferencesGateway extends FinanceReferencesGateway {
  private readonly demo = inject(DemoFinances);

  override categories(): Observable<readonly FinanceCategory[]> {
    return of(
      [...this.demo.categories].sort((first, second) => first.name.localeCompare(second.name)),
    );
  }

  override saveCategory(category: FinanceCategory): Observable<FinanceCategory> {
    this.demo.categories = upsert(this.demo.categories, category);
    return of(category);
  }

  override deleteCategory(categoryId: string): Observable<void> {
    if (this.demo.transactions.some((item) => item.categoryId === categoryId)) {
      return refused('Expected a category nothing was recorded under, but transactions use it');
    }
    this.demo.categories = this.demo.categories.filter((item) => item.id !== categoryId);
    return of(undefined);
  }

  override accounts(): Observable<readonly Account[]> {
    return of([...this.demo.accounts]);
  }

  override saveAccount(account: Account): Observable<Account> {
    this.demo.accounts = upsert(this.demo.accounts, account);
    return of(account);
  }

  override deleteAccount(accountId: string): Observable<void> {
    if (this.demo.transactions.some((item) => item.accountId === accountId)) {
      return refused('Expected an account nothing was recorded on, but transactions use it');
    }
    this.demo.accounts = this.demo.accounts.filter((item) => item.id !== accountId);
    return of(undefined);
  }
}

/** Balances, invoices and card payments worked out by the demo from its own transactions. */
@Injectable()
export class DemoAccountStatementsGateway extends AccountStatementsGateway {
  private readonly demo = inject(DemoFinances);

  override statements(asOf: string): Observable<readonly AccountStatement[]> {
    return of(this.demo.statements(asOf));
  }

  override paymentsInMonth(month: string): Observable<readonly CardPayment[]> {
    return of(this.demo.paymentsIn(month));
  }

  override savePayment(payment: CardPayment): Observable<CardPayment> {
    this.demo.payments = upsert(this.demo.payments, payment);
    return of(payment);
  }

  override deletePayment(paymentId: string): Observable<void> {
    this.demo.payments = this.demo.payments.filter((item) => item.id !== paymentId);
    return of(undefined);
  }
}

/** Bills kept in memory by the demo; settling one records its transaction, as the API does. */
@Injectable()
export class DemoBillsGateway extends BillsGateway {
  private readonly demo = inject(DemoFinances);

  override agenda(asOf: string): Observable<BillsAgenda> {
    return of(this.demo.agenda(asOf));
  }

  override save(billId: string, draft: BillDraft): Observable<readonly Bill[]> {
    return of(this.demo.saveBill(billId, draft));
  }

  override delete(billId: string): Observable<void> {
    this.demo.bills = this.demo.bills.filter((item) => item.id !== billId);
    return of(undefined);
  }

  override settle(billId: string, settlement: BillSettlement): Observable<Bill> {
    const bill = this.demo.settleBill(billId, settlement);
    return bill === undefined
      ? refused(`Expected a bill to settle, received "${billId}"`)
      : of(bill);
  }

  override reopen(billId: string): Observable<Bill> {
    const bill = this.demo.reopenBill(billId);
    return bill === undefined
      ? refused(`Expected a bill to reopen, received "${billId}"`)
      : of(bill);
  }
}

/** The income split plan kept in memory by the demo. */
@Injectable()
export class DemoIncomeSplitGateway extends IncomeSplitGateway {
  private readonly demo = inject(DemoFinances);

  override get(): Observable<IncomeSplit> {
    return of(this.demo.split);
  }

  override save(split: IncomeSplit): Observable<IncomeSplit> {
    this.demo.split = split;
    return of(split);
  }
}

/** Investments, trades and proventos kept in memory by the demo, with the portfolio worked out from them. */
@Injectable()
export class DemoInvestmentsGateway extends InvestmentsGateway {
  private readonly demo = inject(DemoFinances);

  override portfolio(asOf: string): Observable<Portfolio> {
    return of(this.demo.portfolio(asOf));
  }

  override saveInvestment(investmentId: string, draft: InvestmentDraft): Observable<Investment> {
    const investment: Investment = { id: investmentId, ...draft };
    this.demo.investments = upsert(this.demo.investments, investment);
    return of(investment);
  }

  override deleteInvestment(investmentId: string): Observable<void> {
    const isUsed = [...this.demo.trades, ...this.demo.incomes].some(
      (item) => item.investmentId === investmentId,
    );
    if (isUsed)
      return refused('Expected an investment without trades or proventos, but it has them');
    this.demo.investments = this.demo.investments.filter((item) => item.id !== investmentId);
    return of(undefined);
  }

  override saveTrade(tradeId: string, draft: TradeDraft): Observable<Trade> {
    const trade: Trade = { id: tradeId, ...draft };
    this.demo.trades = upsert(this.demo.trades, trade);
    return of(trade);
  }

  override deleteTrade(tradeId: string): Observable<void> {
    this.demo.trades = this.demo.trades.filter((item) => item.id !== tradeId);
    return of(undefined);
  }

  override saveIncome(incomeId: string, draft: IncomeDraft): Observable<Income> {
    const income: Income = { id: incomeId, ...draft };
    this.demo.incomes = upsert(this.demo.incomes, income);
    return of(income);
  }

  override deleteIncome(incomeId: string): Observable<void> {
    this.demo.incomes = this.demo.incomes.filter((item) => item.id !== incomeId);
    return of(undefined);
  }
}
