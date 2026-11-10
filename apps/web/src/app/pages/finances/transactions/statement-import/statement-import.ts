import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { Account, FinanceCategory } from '../../../../core/finances/finance-references';
import { formatBalance, formatSignedMoney } from '../../../../core/finances/money';
import { isCardInvoice, parseCardInvoice } from '../../../../core/finances/card-invoice-import';
import {
  StatementRow,
  parseStatement,
  statementMonths,
  suggestCategoryId,
  toCardPayment,
} from '../../../../core/finances/statement-import';
import { Transaction } from '../../../../core/finances/transaction';
import { StatementImportStore } from '../../../../core/finances/statement-import-store';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** A line of the file with what the person decides about it before importing. */
interface ImportLine {
  readonly row: StatementRow;
  readonly isIncluded: boolean;
  readonly categoryId: string;
  /** The card an invoice payment goes to; empty for any other line. */
  readonly cardId: string;
  /** The bank's identifier is already stored, so importing the line again would only overwrite it. */
  readonly isStored: boolean;
}

/** What an import came to: how many were stored or refused, and the latest month it touched. */
export interface ImportResult {
  readonly saved: number;
  readonly failed: number;
  readonly month: string;
}

/** How many of the problems found in a file are listed; the rest are counted. */
const PROBLEMS_SHOWN = 5;

/** How many months before the end of the statement teach which category a payee belongs to. */
const MEMORY_MONTHS = 6;

/**
 * Panel above the transactions list to import a bank statement (CSV): pick the file, review every line
 * (category, skip) and confirm. Lines already stored are left out, and money moving between the person's
 * own accounts and investments starts unticked. Nothing is saved until the person confirms.
 */
@Component({
  selector: 'app-statement-import',
  imports: [TranslatePipe],
  templateUrl: './statement-import.html',
  styleUrl: './statement-import.css',
})
export class StatementImport {
  readonly categories = input.required<readonly FinanceCategory[]>();
  /** Bank accounts take a bank statement and credit cards take a card invoice file. */
  readonly accounts = input.required<readonly Account[]>();
  readonly defaultAccountId = input<string>();
  readonly dismiss = output();
  /** How many transactions were stored once the import is over. */
  readonly imported = output<ImportResult>();

  private readonly store = inject(StatementImportStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly fileName = signal<string | undefined>(undefined);
  protected readonly isReading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly lines = signal<readonly ImportLine[]>([]);
  protected readonly problems = signal<readonly string[]>([]);
  private readonly chosenAccountId = signal<string | undefined>(undefined);

  protected readonly bankAccounts = computed(() =>
    this.accounts().filter((account) => account.kind === 'bankAccount'),
  );
  /** The cards an invoice payment can be kept for. */
  protected readonly cards = computed(() =>
    this.accounts().filter((account) => account.kind === 'creditCard'),
  );
  /** Whether the file is a card invoice: its lines are purchases on a card, not movements of a bank account. */
  protected readonly isCardFile = signal(false);
  /** Where the lines can go: a card for an invoice file, a bank account for a bank statement. */
  protected readonly targets = computed(() =>
    this.isCardFile() ? this.cards() : this.bankAccounts(),
  );
  protected readonly accountId = computed(() => {
    const targets = this.targets();
    const wanted = [this.chosenAccountId(), this.defaultAccountId()];
    return (
      wanted.map((id) => targets.find((account) => account.id === id)).find(Boolean)?.id ??
      targets[0]?.id
    );
  });
  protected readonly shownProblems = computed(() => this.problems().slice(0, PROBLEMS_SHOWN));
  protected readonly hiddenProblems = computed(() => this.problems().length - PROBLEMS_SHOWN);
  protected readonly selected = computed(() => this.lines().filter((line) => line.isIncluded));
  protected readonly storedCount = computed(
    () => this.lines().filter((line) => line.isStored).length,
  );
  protected readonly internalCount = computed(
    () => this.lines().filter((line) => line.row.kind === 'internal' && !line.isStored).length,
  );
  protected readonly invoiceCount = computed(
    () => this.selected().filter((line) => line.row.kind === 'invoicePayment').length,
  );
  protected readonly canImport = computed(
    () => this.selected().length > 0 && this.accountId() !== undefined && !this.isSaving(),
  );
  protected readonly totals = computed(() => this.describeTotals());
  protected readonly allSelected = computed(() => {
    const open = this.lines().filter((line) => !line.isStored);
    return open.length > 0 && open.every((line) => line.isIncluded);
  });

  protected valueOf(event: Event): string {
    return fieldValue(event);
  }

  protected pickAccount(accountId: string): void {
    this.chosenAccountId.set(accountId);
  }

  /** Reads the chosen file; the lines show once the stored ones are known. */
  protected async readFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file === undefined) return;
    this.fileName.set(file.name);
    this.isReading.set(true);
    this.lines.set([]);
    try {
      await this.showStatement(await file.text());
    } finally {
      this.isReading.set(false);
    }
  }

  protected toggleLine(index: number): void {
    this.updateLine(index, (line) => ({ ...line, isIncluded: !line.isIncluded }));
  }

  protected toggleAll(): void {
    const isIncluded = !this.allSelected();
    this.lines.update((lines) =>
      lines.map((line) => (line.isStored ? line : { ...line, isIncluded })),
    );
  }

  /** Only the line changes: two invoices on the same day can belong to different cards. */
  protected pickCard(index: number, cardId: string): void {
    this.updateLine(index, (line) => ({ ...line, cardId }));
  }

  /** Whether the line can be ticked: stored lines cannot, and an invoice payment needs a card to go to. */
  protected canTick(line: ImportLine): boolean {
    if (line.isStored) return false;
    return line.row.kind !== 'invoicePayment' || this.cards().length > 0;
  }

  /** Every line with the same description takes the category, as they are almost always the same payee. */
  protected pickCategory(index: number, categoryId: string): void {
    const description = this.lines()[index].row.description;
    this.lines.update((lines) =>
      lines.map((line) => (line.row.description === description ? { ...line, categoryId } : line)),
    );
  }

  protected async confirm(): Promise<void> {
    const accountId = this.accountId();
    if (!this.canImport() || accountId === undefined) return;
    this.isSaving.set(true);
    try {
      const kept = this.selected();
      const isPayment = (line: ImportLine): boolean => line.row.kind === 'invoicePayment';
      const result = await this.store.importAll({
        transactions: kept
          .filter((line) => !isPayment(line))
          .map((line) => toTransaction(line, accountId)),
        payments: kept
          .filter((line) => isPayment(line) && line.cardId !== '')
          .map((line) => toCardPayment(line.row, line.cardId, accountId)),
      });
      const month = statementMonths(this.selected().map((line) => line.row)).at(-1) ?? '';
      this.imported.emit({ ...result, month });
    } finally {
      this.isSaving.set(false);
    }
  }

  protected dayOf(row: StatementRow): string {
    return shortDateLabel(row.date, this.locale);
  }

  protected amountOf(row: StatementRow): string {
    return formatSignedMoney(row.amountCents, this.locale);
  }

  private async showStatement(text: string): Promise<void> {
    const isCard = isCardInvoice(text);
    this.isCardFile.set(isCard);
    const statement = isCard ? parseCardInvoice(text) : parseStatement(text);
    this.problems.set(statement.problems);
    if (statement.rows.length === 0) return;
    const months = statementMonths(statement.rows);
    const [stored, memory] = await Promise.all([
      this.store.storedIds(months),
      this.store.categoryMemory(months[months.length - 1], MEMORY_MONTHS),
    ]);
    this.lines.set(
      statement.rows.map((row) => ({
        row,
        isStored: stored.has(row.id),
        isIncluded: !stored.has(row.id) && this.startsTicked(row),
        categoryId: suggestCategoryId(row, this.categories(), memory) ?? '',
        cardId: row.kind === 'invoicePayment' ? (this.cards()[0]?.id ?? '') : '',
      })),
    );
  }

  /** What is earned or spent starts ticked, and so does an invoice payment when there is a card for it. */
  private startsTicked(row: StatementRow): boolean {
    return row.kind === 'regular' || (row.kind === 'invoicePayment' && this.cards().length > 0);
  }

  private updateLine(index: number, change: (line: ImportLine) => ImportLine): void {
    this.lines.update((lines) =>
      lines.map((line, position) => (position === index ? change(line) : line)),
    );
  }

  private describeTotals(): { inCents: number; outCents: number } {
    const amounts = this.selected().map((line) => line.row.amountCents);
    return {
      inCents: amounts.filter((cents) => cents > 0).reduce((sum, cents) => sum + cents, 0),
      outCents: amounts.filter((cents) => cents < 0).reduce((sum, cents) => sum + cents, 0),
    };
  }

  protected balance(cents: number): string {
    return formatBalance(cents, this.locale);
  }

  protected money(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }
}

function toTransaction(line: ImportLine, accountId: string): Transaction {
  const { row } = line;
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    categoryId: line.categoryId,
    accountId,
    amountCents: row.amountCents,
  };
}
