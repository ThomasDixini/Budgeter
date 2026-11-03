import { ModuleSection } from '../modules/module-section';

/** Tabs of the Finances module, in header order; only the sections built so far are listed. */
export const FINANCES_SECTIONS: readonly ModuleSection[] = [
  { label: 'Overview', path: '/finances/overview', matchesChildren: false },
  { label: 'Income split', path: '/finances/income-split', matchesChildren: false },
  { label: 'Transactions', path: '/finances/transactions', matchesChildren: false },
  { label: 'Banks & Cards', path: '/finances/accounts', matchesChildren: false },
  { label: 'To pay & receive', path: '/finances/bills', matchesChildren: false },
];
