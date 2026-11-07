/** Where a module sits along the home → Routines → Finances path the animation follows. */
const MODULE_ORDER: readonly string[] = ['', 'routines', 'finances'];

/** Which way the page slides when the person changes module. */
export type ModuleMove = 'forward' | 'backward';

/**
 * The way to slide when moving from one module's first address segment to another's; undefined while
 * staying in the same module, so moving between its pages is not animated.
 * @example moduleMove('routines', 'finances') // 'forward'
 */
export function moduleMove(fromSegment: string, toSegment: string): ModuleMove | undefined {
  const from = MODULE_ORDER.indexOf(fromSegment);
  const to = MODULE_ORDER.indexOf(toSegment);
  if (from === to || from < 0 || to < 0) return undefined;
  return to > from ? 'forward' : 'backward';
}
