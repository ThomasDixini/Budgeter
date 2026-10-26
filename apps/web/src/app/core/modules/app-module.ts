export type ModuleKind = 'routines' | 'finances' | 'upcoming';

/** Design-system accent names; each maps to `--color-<accent>` and `--color-<accent>-rgb`. */
export type ModuleAccent = 'mint' | 'violet' | 'sky' | 'orchid';

export interface AppModule {
  readonly kind: ModuleKind;
  readonly name: string;
  readonly description: string;
  readonly accent: ModuleAccent;
  /** Absent while the module is not built yet ("coming soon" slots). */
  readonly route?: string;
}

/**
 * Tells whether a module can be opened.
 * @example isModuleAvailable({ kind: 'finances', ..., route: '/finances' }) // true
 */
export function isModuleAvailable(module: AppModule): boolean {
  return module.route !== undefined;
}

/**
 * Builds the CSS value that resolves a module accent to its RGB triplet token.
 * @example accentRgbVariable('mint') // 'var(--color-mint-rgb)'
 */
export function accentRgbVariable(accent: ModuleAccent): string {
  return `var(--color-${accent}-rgb)`;
}
