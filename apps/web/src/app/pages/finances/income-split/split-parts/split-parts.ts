import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import { FinanceCategory } from '../../../../core/finances/finance-references';
import {
  IncomeSplit,
  IncomeSplitPart,
  MAX_PARTS,
  MAX_PART_NAME_LENGTH,
  SPLIT_COLORS,
  partCents,
} from '../../../../core/finances/income-split';
import { formatMoney } from '../../../../core/finances/money';

/** A category toggle in a part's picker. */
interface CategoryChoice {
  readonly id: string;
  readonly name: string;
  readonly isInPart: boolean;
  /** The part that has it when it is another one: choosing it here moves it. */
  readonly movesFrom: string | undefined;
}

/** What one row shows. */
interface PartRow {
  readonly part: IncomeSplitPart;
  readonly color: string;
  readonly colorLabel: string;
  readonly value: string;
  readonly categories: readonly FinanceCategory[];
  readonly choices: readonly CategoryChoice[];
}

/**
 * The parts of the split, one row each: name, color, percentage (slider and number), what it comes to
 * per month, and the categories it spends on. A category counts toward one part only.
 */
@Component({
  selector: 'app-split-parts',
  templateUrl: './split-parts.html',
  styleUrl: './split-parts.css',
})
export class SplitParts {
  readonly split = input.required<IncomeSplit>();
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly rename = output<{ partId: string; name: string }>();
  readonly setPercent = output<{ partId: string; percent: number }>();
  readonly nextColor = output<string>();
  readonly assign = output<{ partId: string; categoryId: string }>();
  readonly unassign = output<string>();
  readonly removePart = output<string>();
  readonly addPart = output();

  private readonly locale = inject(LOCALE_ID);
  protected readonly maxNameLength = MAX_PART_NAME_LENGTH;
  protected readonly canAdd = computed(() => this.split().parts.length < MAX_PARTS);
  /** The part whose category picker is open. */
  protected readonly pickingFor = signal<string | undefined>(undefined);

  protected readonly rows = computed<PartRow[]>(() => {
    const known = new Map(this.categories().map((category) => [category.id, category]));
    return this.split().parts.map((part) => ({
      part,
      color: SPLIT_COLORS[part.color].hex,
      colorLabel: `Change the ${SPLIT_COLORS[part.color].label} color of ${part.name}`,
      value: formatMoney(partCents(this.split().baseIncomeCents, part.percent), this.locale),
      // A category deleted a moment ago can still be listed on the part until the API confirms it.
      categories: part.categoryIds.flatMap((id) => known.get(id) ?? []),
      choices: this.choicesFor(part),
    }));
  });

  protected togglePicker(partId: string): void {
    this.pickingFor.update((open) => (open === partId ? undefined : partId));
  }

  protected toggleCategory(row: PartRow, choice: CategoryChoice): void {
    if (choice.isInPart) this.unassign.emit(choice.id);
    else this.assign.emit({ partId: row.part.id, categoryId: choice.id });
  }

  protected choiceLabel(choice: CategoryChoice): string {
    return choice.movesFrom === undefined
      ? choice.name
      : `${choice.name} (from ${choice.movesFrom})`;
  }

  protected percentOf(event: Event): number {
    return Number.parseInt(fieldValue(event), 10) || 0;
  }

  protected readonly valueOf = fieldValue;

  private choicesFor(part: IncomeSplitPart): CategoryChoice[] {
    const holders = new Map(
      this.split().parts.flatMap((other) => other.categoryIds.map((id) => [id, other] as const)),
    );
    return this.categories().map((category) => {
      const holder = holders.get(category.id);
      return {
        id: category.id,
        name: category.name,
        isInPart: holder?.id === part.id,
        movesFrom: holder === undefined || holder.id === part.id ? undefined : holder.name,
      };
    });
  }
}
