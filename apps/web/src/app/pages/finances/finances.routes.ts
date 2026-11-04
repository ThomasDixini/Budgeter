import { Routes } from '@angular/router';
import { FinancesShell } from './finances-shell/finances-shell';
import { Transactions } from './transactions/transactions';

/**
 * Pages of the Finances module, lazy-loaded under `/finances`. The module root opens Transactions
 * until the overview exists, so Transactions keeps its own address when the overview arrives.
 */
export const FINANCES_ROUTES: Routes = [
  {
    path: '',
    component: FinancesShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'transactions' },
      { path: 'transactions', component: Transactions, title: 'Transactions · Finances' },
    ],
  },
];
