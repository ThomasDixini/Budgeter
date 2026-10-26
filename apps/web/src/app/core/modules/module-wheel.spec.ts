import { AppModule } from './app-module';
import { APP_MODULES } from './module-catalog';
import {
  activeModuleIndex,
  buildWheelSlots,
  rotationTowards,
  signedDistance,
  wheelSlotCount,
  wheelSpinDegrees,
  wrapIndex,
} from './module-wheel';

describe('wrapIndex', () => {
  it('wraps negative values to the end of the range', () => {
    expect(wrapIndex(-1, 4)).toBe(3);
  });

  it('wraps values past the end back to the start', () => {
    expect(wrapIndex(9, 4)).toBe(1);
  });
});

describe('signedDistance', () => {
  it('goes backwards when that is shorter', () => {
    expect(signedDistance(0, 3, 4)).toBe(-1);
  });

  it('goes forward when that is shorter', () => {
    expect(signedDistance(3, 0, 4)).toBe(1);
  });
});

describe('activeModuleIndex', () => {
  it('maps an unbounded rotation to a module index', () => {
    expect(activeModuleIndex(-5, 4)).toBe(3);
  });
});

describe('wheelSlotCount', () => {
  it('repeats modules until there are at least eight slots', () => {
    expect(wheelSlotCount(3)).toBe(9);
  });

  it('keeps the module count when it already fills the wheel', () => {
    expect(wheelSlotCount(10)).toBe(10);
  });
});

describe('wheelSpinDegrees', () => {
  it('spins one slot step counter-clockwise per rotation step', () => {
    expect(wheelSpinDegrees(1, 4)).toBe(-45);
  });
});

describe('buildWheelSlots', () => {
  it('marks only the slot facing up as active', () => {
    const slots = buildWheelSlots(1, APP_MODULES);

    expect(slots.filter((slot) => slot.isActive).map((slot) => slot.angle)).toEqual([45]);
  });

  it('shows only the active slot and its neighbours', () => {
    const slots = buildWheelSlots(0, APP_MODULES);

    expect(slots.filter((slot) => slot.isVisible).map((slot) => slot.angle)).toEqual([0, 45, 315]);
  });

  it('keeps every slot icon upright for the current spin', () => {
    const slots = buildWheelSlots(2, APP_MODULES);

    expect(slots.every((slot) => slot.angle + slot.uprightAngle === 90)).toBe(true);
  });

  it('rejects an empty module list', () => {
    const noModules: readonly AppModule[] = [];

    expect(() => buildWheelSlots(0, noModules)).toThrow('received 0');
  });
});

describe('rotationTowards', () => {
  it('takes the shortest spin to the target module', () => {
    expect(rotationTowards(5, 0, 4)).toBe(4);
  });

  it('keeps the rotation when the target is already active', () => {
    expect(rotationTowards(-2, 2, 4)).toBe(-2);
  });
});
