import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeFinanceReferencesGateway, SAMPLE_ACCOUNTS } from './fake-finances-gateways';
import { Account, AccountDraft } from './finance-references';
import { FinanceReferencesStore } from './finance-references-store';
import { FinanceReferencesGateway } from './transactions-gateway';

const [CHECKING, CARD] = SAMPLE_ACCOUNTS;

const NUBANK: AccountDraft = { name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 15000 };

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Account saves that stay open until a test answers them, to play out a failure that comes late. */
class ControlledSaveReferencesGateway extends FakeFinanceReferencesGateway {
  readonly pendingSaves: Subject<Account>[] = [];

  override saveAccount(account: Account): Observable<Account> {
    this.savedAccounts.push(account);
    const reply = new Subject<Account>();
    this.pendingSaves.push(reply);
    return reply;
  }
}

function createStore(gateway = new FakeFinanceReferencesGateway()): {
  store: FinanceReferencesStore;
  gateway: FakeFinanceReferencesGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: FinanceReferencesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(FinanceReferencesStore), gateway, errors };
}

function names(store: FinanceReferencesStore): string[] {
  return store.accounts().map((account) => account.name);
}

describe('FinanceReferencesStore loading', () => {
  it('loads the categories and the accounts', () => {
    const { store } = createStore();

    expect([store.categories().length, store.accounts().length, store.isLoaded()]).toEqual([
      3,
      2,
      true,
    ]);
  });

  it('offers to try again after a failed load, then loads what was missing', () => {
    const gateway = new FakeFinanceReferencesGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);
    const failed = store.hasLoadFailed();

    gateway.failure = undefined;
    store.reload();

    expect([failed, errors.errors.length, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      true,
      2,
      false,
      true,
    ]);
  });
});

describe('FinanceReferencesStore account writes', () => {
  it('adds an account at the end, saves it and says when it is stored', () => {
    const { store, gateway } = createStore();
    let stored = false;

    const account = store.addAccount(NUBANK, () => (stored = true));

    expect([names(store), gateway.savedAccounts, stored]).toEqual([
      ['Checking account', 'Credit card', 'Nubank'],
      [{ ...NUBANK, id: 'id-1' }],
      true,
    ]);
    expect(account.id).toBe('id-1');
  });

  it('drops an added account the gateway rejects, without saying it is stored', () => {
    const gateway = new FakeFinanceReferencesGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('offline');
    let stored = false;

    store.addAccount(NUBANK, () => (stored = true));

    expect([names(store), errors.errors.length, stored]).toEqual([
      ['Checking account', 'Credit card'],
      1,
      false,
    ]);
  });

  it('edits an account in place', () => {
    const { store } = createStore();

    store.updateAccount(CARD.id, { ...CARD, name: 'Visa' });

    expect(names(store)).toEqual(['Checking account', 'Visa']);
  });

  it('keeps a newer edit when an older one fails late', () => {
    const gateway = new ControlledSaveReferencesGateway();
    const { store } = createStore(gateway);
    store.updateAccount(CARD.id, { ...CARD, name: 'Visa' });
    store.updateAccount(CARD.id, { ...CARD, name: 'Mastercard' });

    gateway.pendingSaves[0].error(new Error('offline'));

    expect(names(store)).toEqual(['Checking account', 'Mastercard']);
  });

  it('puts the previous version back when an edit is rejected', () => {
    const gateway = new FakeFinanceReferencesGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('in use');

    store.updateAccount(CARD.id, { ...CARD, name: 'Visa' });

    expect(names(store)).toEqual(['Checking account', 'Credit card']);
  });

  it('deletes an account and puts it back in place if the gateway rejects it', () => {
    const gateway = new FakeFinanceReferencesGateway();
    const { store } = createStore(gateway);
    store.deleteAccount(CARD.id);
    const afterDelete = names(store);
    gateway.failure = new Error('has transactions');

    store.deleteAccount(CHECKING.id);

    expect([afterDelete, names(store), gateway.deletedAccounts]).toEqual([
      ['Checking account'],
      ['Checking account'],
      [CARD.id, CHECKING.id],
    ]);
  });
});
