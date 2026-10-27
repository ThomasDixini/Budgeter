import { IdGenerator } from './id-generator';
import { SequentialIdGenerator } from './sequential-id-generator';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('IdGenerator', () => {
  it('creates version 4 UUIDs', () => {
    expect(new IdGenerator().next()).toMatch(UUID_V4_PATTERN);
  });

  it('never repeats an id', () => {
    const generator = new IdGenerator();

    expect(generator.next()).not.toBe(generator.next());
  });
});

describe('SequentialIdGenerator', () => {
  it('counts up from one', () => {
    const generator = new SequentialIdGenerator();
    generator.next();

    expect(generator.next()).toBe('id-2');
  });
});
