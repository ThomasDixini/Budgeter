/** One tab of a module's header. */
export interface ModuleSection {
  readonly label: string;
  readonly path: string;
  /** Whether nested routes (e.g. a category detail) also light up this tab. */
  readonly matchesChildren: boolean;
}
