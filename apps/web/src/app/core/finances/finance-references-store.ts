import { ErrorHandler, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { Positioned, positionOf, restoredAt, sameId } from '../lists/list-positions';
import { Account, AccountDraft, FinanceCategory } from './finance-references';
import { FinanceReferencesGateway } from './transactions-gateway';

/** Called once the API stored a change, for whatever depends on the stored data (e.g. balances). */
export type OnStored = () => void;

const NOTHING_TO_DO: OnStored = () => undefined;

/**
 * The finance categories and accounts every Finances page refers to, loaded once and shared, so an
 * account added on one page is offered on the others. Account changes apply locally first and roll back
 * if the gateway rejects them, without undoing what changed in the meantime.
 */
@Injectable({ providedIn: 'root' })
export class FinanceReferencesStore {
  private readonly gateway = inject(FinanceReferencesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly categoryList = signal<readonly FinanceCategory[]>([]);
  private readonly accountList = signal<readonly Account[]>([]);
  private readonly categoriesLoaded = signal(false);
  private readonly accountsLoaded = signal(false);
  private readonly loadFailed = signal(false);

  readonly categories = this.categoryList.asReadonly();
  /** Bank accounts and credit cards, in creation order. */
  readonly accounts = this.accountList.asReadonly();
  /** Whether both lists arrived, so "empty" can be told apart from "still loading". */
  readonly isLoaded = computed(() => this.categoriesLoaded() && this.accountsLoaded());
  /** Whether loading failed, so the page can offer to try again. */
  readonly hasLoadFailed = this.loadFailed.asReadonly();

  constructor() {
    this.loadMissing();
  }

  /**
   * Loads again whatever did not arrive, after a failed load; what did arrive is kept.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.loadMissing();
  }

  /**
   * Adds an account at the end of the list and saves it.
   * @example store.addAccount({ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 0 }, refreshBalances)
   */
  addAccount(draft: AccountDraft, onStored: OnStored = NOTHING_TO_DO): Account {
    const account: Account = { ...draft, id: this.ids.next() };
    this.accountList.update((list) => [...list, account]);
    // Removed only while it is still the version added: an edit since then is saved by its own request.
    const dropAdded = (): void =>
      this.accountList.update((list) => list.filter((current) => current !== account));
    this.send(this.gateway.saveAccount(account), onStored, dropAdded);
    return account;
  }

  /**
   * Edits an account in place. A failed save puts the previous version back only if this edit is still
   * the one shown.
   * @example store.updateAccount('credit-card', { ...card, name: 'Visa' }, refreshBalances)
   */
  updateAccount(
    accountId: string,
    draft: AccountDraft,
    onStored: OnStored = NOTHING_TO_DO,
  ): Account | undefined {
    const previous = positionOf(this.accountList(), (current) => current.id === accountId);
    if (previous === undefined) return undefined;
    const account: Account = { ...draft, id: accountId };
    this.replace(previous.record, account);
    this.send(this.gateway.saveAccount(account), onStored, () =>
      this.replace(account, previous.record),
    );
    return account;
  }

  /**
   * Deletes an account; puts it back in place if the gateway rejects it (one with transactions is kept).
   * @example store.deleteAccount('old-card', refreshBalances)
   */
  deleteAccount(accountId: string, onStored: OnStored = NOTHING_TO_DO): void {
    const removed = positionOf(this.accountList(), (current) => current.id === accountId);
    this.accountList.update((list) => list.filter((current) => current.id !== accountId));
    this.send(this.gateway.deleteAccount(accountId), onStored, () => this.putBack(removed));
  }

  private loadMissing(): void {
    if (!this.categoriesLoaded()) {
      this.gateway.categories().subscribe(this.loadInto(this.categoryList, this.categoriesLoaded));
    }
    if (!this.accountsLoaded()) {
      this.gateway.accounts().subscribe(this.loadInto(this.accountList, this.accountsLoaded));
    }
  }

  private loadInto<TRecord>(
    list: WritableSignal<readonly TRecord[]>,
    flag: WritableSignal<boolean>,
  ): Partial<Observer<readonly TRecord[]>> {
    return {
      next: (records) => {
        list.set(records);
        flag.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    };
  }

  private send(request: Observable<unknown>, onStored: OnStored, rollback: () => void): void {
    request.subscribe({
      next: () => onStored(),
      error: (error: unknown) => {
        rollback();
        this.errorHandler.handleError(error);
      },
    });
  }

  // Swaps by identity, so a version replaced again in the meantime is left alone.
  private replace(current: Account, next: Account): void {
    this.accountList.update((list) =>
      list.map((account) => (account === current ? next : account)),
    );
  }

  private putBack(removed: Positioned<Account> | undefined): void {
    if (removed === undefined) return;
    this.accountList.update((list) => restoredAt(list, removed, sameId));
  }
}
