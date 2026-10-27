import { countLabel, findCategory, withAlpha } from './category';
import { SAMPLE_CATEGORIES } from './sample-routines';

describe('withAlpha', () => {
  it('turns a hex color into a translucent rgba', () => {
    expect(withAlpha('#7DD3FC', 0.5)).toBe('rgba(125, 211, 252, 0.5)');
  });

  it('rejects a color that is not #RRGGBB', () => {
    expect(() => withAlpha('blue', 1)).toThrow('"blue"');
  });
});

describe('findCategory', () => {
  it('finds a category by id', () => {
    expect(findCategory(SAMPLE_CATEGORIES, 'study')?.name).toBe('Study');
  });

  it('answers undefined for a block without category', () => {
    expect(findCategory(SAMPLE_CATEGORIES, undefined)).toBeUndefined();
  });
});

describe('countLabel', () => {
  it('keeps the noun singular for one', () => {
    expect(countLabel(1, 'goal')).toBe('1 goal');
  });

  it('pluralizes other counts', () => {
    expect(countLabel(0, 'block')).toBe('0 blocks');
  });
});
