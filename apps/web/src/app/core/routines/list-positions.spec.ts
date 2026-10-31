import { positionOf, positionsOf, restoredAllAt, restoredAt, sameId } from './list-positions';

const A = { id: 'a' };
const B = { id: 'b' };
const C = { id: 'c' };

describe('positionOf', () => {
  it('finds the first match with its index', () => {
    expect(positionOf([A, B, C], (record) => record.id === 'b')).toEqual({ record: B, index: 1 });
  });

  it('is undefined when nothing matches', () => {
    expect(positionOf([A, B], (record) => record.id === 'x')).toBeUndefined();
  });
});

describe('positionsOf', () => {
  it('keeps every match with its index, in list order', () => {
    const matches = positionsOf([A, B, C], (record) => record.id !== 'b');

    expect(matches).toEqual([
      { record: A, index: 0 },
      { record: C, index: 2 },
    ]);
  });
});

describe('restoredAt', () => {
  it('puts the record back where it was', () => {
    expect(restoredAt([A, C], { record: B, index: 1 }, sameId)).toEqual([A, B, C]);
  });

  it('keeps what was added in the meantime', () => {
    const added = { id: 'new' };

    expect(restoredAt([A, C, added], { record: B, index: 1 }, sameId)).toEqual([A, B, C, added]);
  });

  it('appends the record when the list got shorter than its old index', () => {
    expect(restoredAt([A], { record: C, index: 2 }, sameId)).toEqual([A, C]);
  });

  it('leaves the list alone when the record is already back', () => {
    const newer = { id: 'b', name: 'newer' };

    expect(restoredAt([A, newer], { record: B, index: 1 }, sameId)).toEqual([A, newer]);
  });
});

describe('restoredAllAt', () => {
  it('puts several records back at their old indexes', () => {
    const removed = positionsOf([A, B, C], (record) => record.id !== 'b');

    expect(restoredAllAt([B], removed, sameId)).toEqual([A, B, C]);
  });
});

describe('sameId', () => {
  it('compares records by id only', () => {
    expect([sameId(A, { id: 'a' }), sameId(A, B)]).toEqual([true, false]);
  });
});
