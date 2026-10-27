/** A life area (study, networking…) that groups routine blocks and goals. */
export interface Category {
  readonly id: string;
  readonly name: string;
  /** `#RRGGBB` accent used for dots, bars and glows. */
  readonly color: string;
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

/** Accent choices offered when creating a category, in picker order. */
export const CATEGORY_SWATCHES: readonly { readonly color: string; readonly label: string }[] = [
  { color: '#86EFAC', label: 'Green' },
  { color: '#7DD3FC', label: 'Blue' },
  { color: '#F0ABFC', label: 'Pink' },
  { color: '#FBBF24', label: 'Amber' },
  { color: '#FCA5A5', label: 'Coral' },
  { color: '#C4B5FD', label: 'Lilac' },
];

/**
 * Translucent version of a category color, for tints and borders.
 * @example withAlpha('#7DD3FC', 0.5) // 'rgba(125, 211, 252, 0.5)'
 */
export function withAlpha(hexColor: string, alpha: number): string {
  const match = HEX_COLOR_PATTERN.exec(hexColor);
  if (match === null) {
    throw new RangeError(`Expected a color shaped like #RRGGBB, received "${hexColor}"`);
  }
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/**
 * Finds a category by id; blocks may have none, so absence is a normal answer.
 * @example findCategory(categories, 'study')?.name // 'Study'
 */
export function findCategory(
  categories: readonly Category[],
  categoryId: string | undefined,
): Category | undefined {
  return categories.find((category) => category.id === categoryId);
}

/**
 * Pluralizes a count with its noun.
 * @example countLabel(1, 'goal') // '1 goal'
 */
export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
