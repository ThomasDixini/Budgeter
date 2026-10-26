import { AppModule } from './app-module';

/** The wheel repeats the modules until it has at least this many slots, so it never looks sparse. */
const MIN_WHEEL_SLOTS = 8;
const FULL_TURN_DEGREES = 360;

export interface WheelSlot {
  readonly module: AppModule;
  /** Position of the slot on the wheel, in degrees. */
  readonly angle: number;
  /** Counter-rotation that keeps the slot icon upright while the wheel spins. */
  readonly uprightAngle: number;
  readonly isActive: boolean;
  /** Only the active slot and its direct neighbours are shown above the dome edge. */
  readonly isVisible: boolean;
}

/**
 * Wraps any integer into the `[0, length)` range.
 * @example wrapIndex(-1, 4) // 3
 */
export function wrapIndex(value: number, length: number): number {
  return ((value % length) + length) % length;
}

/**
 * Shortest signed step count from `from` to `to` on a circle of `length` positions.
 * @example signedDistance(0, 3, 4) // -1
 */
export function signedDistance(from: number, to: number, length: number): number {
  const distance = wrapIndex(to - from, length);
  return distance > length / 2 ? distance - length : distance;
}

/**
 * Index of the module facing up for an unbounded wheel rotation.
 * @example activeModuleIndex(-1, 4) // 3
 */
export function activeModuleIndex(rotation: number, moduleCount: number): number {
  return wrapIndex(rotation, moduleCount);
}

/**
 * Number of slots drawn on the wheel: a multiple of the module count, at least MIN_WHEEL_SLOTS.
 * @example wheelSlotCount(3) // 9
 */
export function wheelSlotCount(moduleCount: number): number {
  return moduleCount * Math.ceil(MIN_WHEEL_SLOTS / moduleCount);
}

/**
 * Wheel spin in degrees for a rotation; rotation stays unbounded so CSS never animates the long way.
 * @example wheelSpinDegrees(1, 4) // -45
 */
export function wheelSpinDegrees(rotation: number, moduleCount: number): number {
  return -rotation * (FULL_TURN_DEGREES / wheelSlotCount(moduleCount));
}

/**
 * Lays out every wheel slot for the given rotation.
 * @example buildWheelSlots(0, APP_MODULES)[0].isActive // true
 */
export function buildWheelSlots(rotation: number, modules: readonly AppModule[]): WheelSlot[] {
  if (modules.length === 0) {
    throw new Error(`Expected at least one module to build the wheel, received ${modules.length}`);
  }
  const slotCount = wheelSlotCount(modules.length);
  return Array.from({ length: slotCount }, (_, index) =>
    buildWheelSlot(index, rotation, modules, slotCount),
  );
}

/**
 * Rotation that brings `targetIndex` to the top using the shortest spin.
 * @example rotationTowards(5, 0, 4) // 4
 */
export function rotationTowards(
  rotation: number,
  targetIndex: number,
  moduleCount: number,
): number {
  const currentIndex = activeModuleIndex(rotation, moduleCount);
  return rotation + signedDistance(currentIndex, targetIndex, moduleCount);
}

function buildWheelSlot(
  index: number,
  rotation: number,
  modules: readonly AppModule[],
  slotCount: number,
): WheelSlot {
  const angle = index * (FULL_TURN_DEGREES / slotCount);
  const distance = signedDistance(rotation, index, slotCount);
  return {
    module: modules[index % modules.length],
    angle,
    uprightAngle: -(angle + wheelSpinDegrees(rotation, modules.length)),
    isActive: distance === 0,
    isVisible: Math.abs(distance) <= 1,
  };
}
