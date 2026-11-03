/*
 * Rolling back an optimistic removal one record at a time. Putting a whole snapshot of the list back
 * would also undo whatever was added, edited or removed while the request was in flight.
 */

/** A record and the index it had in its list when it was taken out. */
export interface Positioned<TRecord> {
  readonly record: TRecord;
  readonly index: number;
}

/**
 * The first record that matches, with its index; undefined when none does.
 * @example positionOf(goals, (goal) => goal.id === 'g3') // { record: g3, index: 2 }
 */
export function positionOf<TRecord>(
  records: readonly TRecord[],
  matches: (record: TRecord) => boolean,
): Positioned<TRecord> | undefined {
  const index = records.findIndex(matches);
  return index === -1 ? undefined : { record: records[index], index };
}

/**
 * Every record that matches, with its index, in list order.
 * @example positionsOf(goals, (goal) => goal.categoryId === 'study').map((item) => item.index) // [0, 2]
 */
export function positionsOf<TRecord>(
  records: readonly TRecord[],
  matches: (record: TRecord) => boolean,
): Positioned<TRecord>[] {
  return records.flatMap((record, index) => (matches(record) ? [{ record, index }] : []));
}

/**
 * The list with a removed record back at its old index (or at the end, if the list got shorter). A list
 * that already holds the same record, as told by `isSame`, is returned unchanged.
 * @example restoredAt(goalsWithoutG3, { record: g3, index: 2 }, (first, second) => first.id === second.id)
 */
export function restoredAt<TRecord>(
  records: readonly TRecord[],
  removed: Positioned<TRecord>,
  isSame: (first: TRecord, second: TRecord) => boolean,
): TRecord[] {
  if (records.some((current) => isSame(current, removed.record))) return [...records];
  return [...records.slice(0, removed.index), removed.record, ...records.slice(removed.index)];
}

/**
 * The list with every removed record back at its old index; give them in ascending index order, as
 * `positionsOf` does, so each one lands where it was.
 * @example restoredAllAt(goalsWithoutStudy, positionsOf(goals, isStudy), sameId)
 */
export function restoredAllAt<TRecord>(
  records: readonly TRecord[],
  removed: readonly Positioned<TRecord>[],
  isSame: (first: TRecord, second: TRecord) => boolean,
): TRecord[] {
  return removed.reduce((current, item) => restoredAt(current, item, isSame), [...records]);
}

/**
 * Whether two records carry the same id.
 * @example sameId({ id: 'g1' }, { id: 'g1' }) // true
 */
export function sameId(first: { readonly id: string }, second: { readonly id: string }): boolean {
  return first.id === second.id;
}
