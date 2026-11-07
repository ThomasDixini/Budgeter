import { Component, LOCALE_ID, computed, inject, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { readFirstSheet } from '../../../../core/files/xlsx-reader';
import {
  MovementRow,
  PlannedMovement,
  buildBatch,
  investmentKindOf,
  parseMovements,
  planMovements,
} from '../../../../core/finances/investment-import';
import {
  INVESTMENT_KIND_OPTIONS,
  InvestmentKind,
  incomeKindLabel,
  quantityText,
} from '../../../../core/finances/investments';
import { InvestmentsStore } from '../../../../core/finances/investments-store';
import { formatMoney } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** A line of the file with what the person decides about it before importing. */
interface MovementLine extends PlannedMovement {
  readonly isIncluded: boolean;
}

/** What an import came to: how many records were stored or refused. */
export interface MovementImportResult {
  readonly saved: number;
  readonly failed: number;
}

/** How many of the problems found in a file are listed; the rest are counted. */
const PROBLEMS_SHOWN = 5;

/**
 * Panel above the investments to import the "Movimentação" workbook the broker exports (`.xlsx`): pick the
 * file, review the purchases, sales and proventos it holds and confirm. Investments that do not exist yet
 * are created (their kind can be changed first); lines already stored, and the ones that move no money
 * (rights, updates), are left out. Nothing is saved until the person confirms.
 */
@Component({
  selector: 'app-movement-import',
  imports: [TranslatePipe],
  templateUrl: './movement-import.html',
  styleUrl: './movement-import.css',
})
export class MovementImport {
  readonly dismiss = output();
  readonly imported = output<MovementImportResult>();

  private readonly store = inject(InvestmentsStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly kindOptions = INVESTMENT_KIND_OPTIONS;
  protected readonly fileName = signal<string | undefined>(undefined);
  protected readonly isReading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly lines = signal<readonly MovementLine[]>([]);
  protected readonly problems = signal<readonly string[]>([]);
  private readonly chosenKinds = signal<Readonly<Record<string, InvestmentKind>>>({});

  protected readonly shownProblems = computed(() => this.problems().slice(0, PROBLEMS_SHOWN));
  protected readonly hiddenProblems = computed(() => this.problems().length - PROBLEMS_SHOWN);
  protected readonly selected = computed(() => this.lines().filter((line) => line.isIncluded));
  protected readonly counts = computed(() => this.describeCounts());
  protected readonly newInvestments = computed(() => this.listNewInvestments());
  protected readonly canImport = computed(() => this.selected().length > 0 && !this.isSaving());
  protected readonly allSelected = computed(() => {
    const open = this.lines().filter(isOpen);
    return open.length > 0 && open.every((line) => line.isIncluded);
  });

  protected valueOf(event: Event): string {
    return fieldValue(event);
  }

  /** Reads the chosen workbook; the lines show once what is stored is known. */
  protected async readFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file === undefined) return;
    this.fileName.set(file.name);
    this.isReading.set(true);
    this.lines.set([]);
    try {
      await this.readWorkbook(await file.arrayBuffer());
    } catch (error) {
      this.problems.set([error instanceof Error ? error.message : String(error)]);
    } finally {
      this.isReading.set(false);
    }
  }

  protected toggleLine(index: number): void {
    this.lines.update((lines) =>
      lines.map((line, position) =>
        position === index ? { ...line, isIncluded: !line.isIncluded } : line,
      ),
    );
  }

  protected toggleAll(): void {
    const isIncluded = !this.allSelected();
    this.lines.update((lines) =>
      lines.map((line) => (isOpen(line) ? { ...line, isIncluded } : line)),
    );
  }

  protected pickKind(name: string, kind: string): void {
    this.chosenKinds.update((kinds) => ({ ...kinds, [name]: kind as InvestmentKind }));
  }

  protected async confirm(): Promise<void> {
    if (!this.canImport()) return;
    this.isSaving.set(true);
    try {
      const kinds = this.chosenKinds();
      const batch = buildBatch(this.selected(), (name) => kinds[name] ?? investmentKindOf(name));
      this.imported.emit(await this.store.importBatch(batch));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected labelOf(row: MovementRow): string {
    if (row.action === 'buy') return 'Purchase';
    if (row.action === 'sell') return 'Sale';
    return row.action === 'income' && row.incomeKind
      ? incomeKindLabel(row.incomeKind)
      : row.movement;
  }

  protected dayOf(row: MovementRow): string {
    return shortDateLabel(row.date, this.locale);
  }

  protected quantityOf(row: MovementRow): string {
    return row.action === 'ignored' ? '' : quantityText(row.quantityThousandths);
  }

  protected amountOf(row: MovementRow): string {
    return row.action === 'ignored' ? '' : formatMoney(row.amountCents, this.locale);
  }

  protected kindOf(name: string): InvestmentKind {
    return this.chosenKinds()[name] ?? investmentKindOf(name);
  }

  private async readWorkbook(workbook: ArrayBuffer): Promise<void> {
    const parsed = parseMovements(await readFirstSheet(new Uint8Array(workbook)));
    this.problems.set(parsed.problems);
    const portfolio = this.store.portfolio();
    const planned = planMovements(parsed.rows, {
      investments: (portfolio?.lines ?? []).map((line) => line.investment),
      trades: portfolio?.trades ?? [],
      incomes: portfolio?.incomes ?? [],
    });
    this.lines.set(planned.map((line) => ({ ...line, isIncluded: isOpen(line) })));
  }

  private describeCounts(): {
    buys: number;
    sells: number;
    incomes: number;
    left: number;
    stored: number;
  } {
    const lines = this.lines();
    const kept = lines.filter((line) => line.isIncluded);
    const count = (action: string): number =>
      kept.filter((line) => line.row.action === action).length;
    return {
      buys: count('buy'),
      sells: count('sell'),
      incomes: count('income'),
      left: lines.filter((line) => line.row.action === 'ignored').length,
      stored: lines.filter((line) => line.isStored).length,
    };
  }

  private listNewInvestments(): string[] {
    const names = this.selected()
      .filter((line) => line.investmentId === undefined)
      .map((line) => line.row.name);
    return [...new Set(names)];
  }
}

/** Whether a line can be imported: it moves money and is not stored yet. */
function isOpen(line: PlannedMovement): boolean {
  return line.row.action !== 'ignored' && !line.isStored;
}
