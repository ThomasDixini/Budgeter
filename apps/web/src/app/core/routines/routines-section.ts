/** One tab of the Routines & Goals module header. */
export interface RoutinesSection {
  readonly label: string;
  readonly path: string;
  /** Whether nested routes (e.g. a category detail) also light up this tab. */
  readonly matchesChildren: boolean;
}

/** Tabs of the Routines & Goals module, in header order. */
export const ROUTINES_SECTIONS: readonly RoutinesSection[] = [
  { label: 'Today', path: '/routines', matchesChildren: false },
  { label: 'Routine', path: '/routines/routine', matchesChildren: false },
  { label: 'Categories & Goals', path: '/routines/categories', matchesChildren: true },
];
