import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TitleStrategy, provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { provideLanguage } from './core/i18n/locale-provider';
import { animateModuleSwitch } from './core/modules/module-view-transition';
import { NET_WORTH_HISTORY } from './core/finances/net-worth-store';
import { DemoFinances } from './core/finances/demo/demo-finances';
import {
  DemoAccountStatementsGateway,
  DemoBillsGateway,
  DemoFinanceReferencesGateway,
  DemoIncomeSplitGateway,
  DemoInvestmentsGateway,
  DemoTransactionsGateway,
} from './core/finances/demo/demo-gateways';
import { applyDemoFromAddress, isDemoMode } from './core/finances/demo/demo-mode';
import {
  DemoBlockOutcomesGateway,
  DemoCategoriesGateway,
  DemoGoalsGateway,
  DemoRoutinesGateway,
  DemoTasksGateway,
} from './core/routines/demo/demo-routines-gateways';
import { TranslatedTitleStrategy } from './core/i18n/translated-title-strategy';
import { NoticeErrorHandler } from './core/notices/notice-error-handler';
import { CategoriesGateway } from './core/routines/categories-gateway';
import { GoalsGateway } from './core/routines/goals-gateway';
import { HttpCategoriesGateway } from './core/routines/http-categories-gateway';
import { HttpGoalsGateway } from './core/routines/http-goals-gateway';
import { HttpRoutinesGateway } from './core/routines/http-routines-gateway';
import { BlockOutcomesGateway } from './core/routines/block-outcomes-gateway';
import { HttpBlockOutcomesGateway } from './core/routines/http-block-outcomes-gateway';
import { HttpTasksGateway } from './core/routines/http-tasks-gateway';
import { RoutinesGateway } from './core/routines/routines-gateway';
import { TasksGateway } from './core/routines/tasks-gateway';
import {
  HttpFinanceReferencesGateway,
  HttpTransactionsGateway,
} from './core/finances/http-transactions-gateway';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from './core/finances/transactions-gateway';
import { AccountStatementsGateway } from './core/finances/account-statements-gateway';
import { HttpAccountStatementsGateway } from './core/finances/http-account-statements-gateway';
import { HttpIncomeSplitGateway } from './core/finances/http-income-split-gateway';
import { IncomeSplitGateway } from './core/finances/income-split-gateway';
import { BillsGateway } from './core/finances/bills-gateway';
import { HttpInvestmentsGateway } from './core/finances/http-investments-gateway';
import { InvestmentsGateway } from './core/finances/investments-gateway';
import { HttpBillsGateway } from './core/finances/http-bills-gateway';

// A link with ?demo=on (or off) switches the made-up data before the gateways are chosen.
applyDemoFromAddress(globalThis.location?.search ?? '');
const isDemo = isDemoMode();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated: animateModuleSwitch })),
    provideLanguage(),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    { provide: ErrorHandler, useClass: NoticeErrorHandler },
    {
      provide: CategoriesGateway,
      useClass: isDemo ? DemoCategoriesGateway : HttpCategoriesGateway,
    },
    { provide: GoalsGateway, useClass: isDemo ? DemoGoalsGateway : HttpGoalsGateway },
    { provide: RoutinesGateway, useClass: isDemo ? DemoRoutinesGateway : HttpRoutinesGateway },
    { provide: TasksGateway, useClass: isDemo ? DemoTasksGateway : HttpTasksGateway },
    {
      provide: BlockOutcomesGateway,
      useClass: isDemo ? DemoBlockOutcomesGateway : HttpBlockOutcomesGateway,
    },
    {
      provide: TransactionsGateway,
      useClass: isDemo ? DemoTransactionsGateway : HttpTransactionsGateway,
    },
    {
      provide: FinanceReferencesGateway,
      useClass: isDemo ? DemoFinanceReferencesGateway : HttpFinanceReferencesGateway,
    },
    {
      provide: AccountStatementsGateway,
      useClass: isDemo ? DemoAccountStatementsGateway : HttpAccountStatementsGateway,
    },
    {
      provide: IncomeSplitGateway,
      useClass: isDemo ? DemoIncomeSplitGateway : HttpIncomeSplitGateway,
    },
    { provide: BillsGateway, useClass: isDemo ? DemoBillsGateway : HttpBillsGateway },
    {
      provide: InvestmentsGateway,
      useClass: isDemo ? DemoInvestmentsGateway : HttpInvestmentsGateway,
    },
    ...(isDemo
      ? [
          {
            provide: NET_WORTH_HISTORY,
            useFactory: () => {
              const demo = inject(DemoFinances);
              return () => demo.netWorthHistory();
            },
          },
        ]
      : []),
  ],
};
