import { ModuleSection } from '../modules/module-section';

/** Tabs of the Routines & Goals module, in header order. */
export const ROUTINES_SECTIONS: readonly ModuleSection[] = [
  { label: 'Today', path: '/routines', matchesChildren: false },
  { label: 'Routine', path: '/routines/routine', matchesChildren: false },
  { label: 'Categories & Goals', path: '/routines/categories', matchesChildren: true },
  { label: 'History', path: '/routines/history', matchesChildren: false },
];
