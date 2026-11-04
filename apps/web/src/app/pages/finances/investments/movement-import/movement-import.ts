import { Component, LOCALE_ID, computed, inject, output, signal } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { readFirstSheet } from '../../../../core/files/xlsx-reader';
import {
  MovementRow,
  PlannedMovement,
  StoredPortfolio,
  applyMerges,
  buildBatch,
  investmentKindOf,
  parseMovements,
  planMovements,
  suggestMerges,
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

/** One investment named in the file, and where its lines go. */
interface FileInvestment {
  readonly name: string;
  /** The investment its lines end up on: itself, or the one it is merged into. */
  readonly target: string;
  /** Whether the target does not exist yet, so its kind can still be picked. */
  readonly isNew: boolean;
  /** The other names it can be merged into: the rest of the file's and the ones already stored. */
  readonly mergeOptions: readonly string[];
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
 * (rights, updates), are left out. A fund that changed its ticker shows under both: the older one is
 * suggested to be merged into the newer, and any investment can be merged into another. Nothing is saved
 * until the person confirms.
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
  protected readonly problems = signal<readonly string[]>([]);
  /** The lines as the file has them, with their own names. */
  private readonly rows = signal<readonly MovementRow[]>([]);
  /** What was stored when the file was read. */
  private readonly stored = signal<StoredPortfolio>({ investments: [], trades: [], incomes: [] });
  /** Investment name -> the name it is merged into; the file's own suggestion until the person changes it. */
  private readonly merges = signal<Readonly<Record<string, string>>>({});
  /** Ids of the lines the person unticked, which stay unticked whatever else changes. */
  private readonly unticked = signal<ReadonlySet<string>>(new Set());
  private readonly chosenKinds = signal<Readonly<Record<string, InvestmentKind>>>({});

  protected readonly lines = computed<readonly MovementLine[]>(() => this.planLines());
  protected readonly investments = computed(() => this.listInvestments());
  protected readonly shownProblems = computed(() => this.problems().slice(0, PROBLEMS_SHOWN));
  protected readonly hiddenProblems = computed(() => this.problems().length - PROBLEMS_SHOWN);
  protected readonly selected = computed(() => this.lines().filter((line) => line.isIncluded));
  protected readonly counts = computed(() => this.describeCounts());
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
    this.rows.set([]);
    try {
      await this.readWorkbook(await file.arrayBuffer());
    } catch (error) {
      this.problems.set([error instanceof Error ? error.message : String(error)]);
    } finally {
      this.isReading.set(false);
    }
  }

  protected toggleLine(index: number): void {
    const id = this.lines()[index].row.id;
    this.unticked.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected toggleAll(): void {
    const open = this.lines().filter(isOpen);
    this.unticked.set(this.allSelected() ? new Set(open.map((line) => line.row.id)) : new Set());
  }

  protected pickKind(name: string, kind: string): void {
    this.chosenKinds.update((kinds) => ({ ...kinds, [name]: kind as InvestmentKind }));
  }

  /** Sends the lines of an investment to another one, or back to its own name. */
  protected pickMerge(name: string, target: string): void {
    this.merges.update((merges) => {
      const rest = Object.fromEntries(Object.entries(merges).filter(([source]) => source !== name));
      return target === name ? rest : { ...rest, [name]: target };
    });
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
    this.stored.set({
      investments: (portfolio?.lines ?? []).map((line) => line.investment),
      trades: portfolio?.trades ?? [],
      incomes: portfolio?.incomes ?? [],
    });
    this.unticked.set(new Set());
    this.chosenKinds.set({});
    this.merges.set(suggestMerges(parsed.rows));
    this.rows.set(parsed.rows);
  }

  private planLines(): MovementLine[] {
    const merged = applyMerges(this.rows(), this.merges());
    return planMovements(merged, this.stored()).map((line) => ({
      ...line,
      isIncluded: isOpen(line) && !this.unticked().has(line.row.id),
    }));
  }

  /** The investments the file names, in the order they first appear, with where their lines go. */
  private listInvestments(): FileInvestment[] {
    const rows = this.rows().filter((row) => row.action !== 'ignored');
    const merged = applyMerges(rows, this.merges());
    const names = [...new Set(rows.map((row) => row.name))];
    const targets = new Map(rows.map((row, index) => [row.name, merged[index].name]));
    const known = this.stored().investments.map((investment) => investment.name);
    return names.map((name) => {
      const target = targets.get(name) ?? name;
      return {
        name,
        target,
        isNew: !known.some((existing) => existing.toLowerCase() === target.toLowerCase()),
        mergeOptions: [...new Set([...names, ...known])].filter((other) => other !== name),
      };
    });
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
}

/** Whether a line can be imported: it moves money and is not stored yet. */
function isOpen(line: PlannedMovement): boolean {
  return line.row.action !== 'ignored' && !line.isStored;
}
