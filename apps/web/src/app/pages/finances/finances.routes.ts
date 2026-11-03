import { Routes } from '@angular/router';
import { Accounts } from './accounts/accounts';
import { Bills } from './bills/bills';
import { FinancesShell } from './finances-shell/finances-shell';
import { Investments } from './investments/investments';
import { NetWorth } from './net-worth/net-worth';
import { Overview } from './overview/overview';
import { IncomeSplitPage } from './income-split/income-split';
import { Transactions } from './transactions/transactions';

/** Pages of the Finances module, lazy-loaded under `/finances`; the module root opens the Overview. */
export const FINANCES_ROUTES: Routes = [
  {
    path: '',
    component: FinancesShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: Overview, title: 'Overview · Finances' },
      { path: 'income-split', component: IncomeSplitPage, title: 'Income split · Finances' },
      { path: 'transactions', component: Transactions, title: 'Transactions · Finances' },
      { path: 'accounts', component: Accounts, title: 'Banks & Cards · Finances' },
      { path: 'investments', component: Investments, title: 'Investments · Finances' },
      { path: 'net-worth', component: NetWorth, title: 'Net worth · Finances' },
      { path: 'bills', component: Bills, title: 'To pay & receive · Finances' },
    ],
  },
];
