import { Routes } from '@angular/router';
import { Accounts } from './accounts/accounts';
import { Bills } from './bills/bills';
import { FinancesShell } from './finances-shell/finances-shell';
import { IncomeSplitPage } from './income-split/income-split';
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
      { path: 'income-split', component: IncomeSplitPage, title: 'Income split · Finances' },
      { path: 'transactions', component: Transactions, title: 'Transactions · Finances' },
      { path: 'accounts', component: Accounts, title: 'Banks & Cards · Finances' },
      { path: 'bills', component: Bills, title: 'To pay & receive · Finances' },
    ],
  },
];
