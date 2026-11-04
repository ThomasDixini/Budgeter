import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideLanguage } from './core/i18n/locale-provider';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    provideLanguage(),
    { provide: ErrorHandler, useClass: NoticeErrorHandler },
    { provide: CategoriesGateway, useClass: HttpCategoriesGateway },
    { provide: GoalsGateway, useClass: HttpGoalsGateway },
    { provide: RoutinesGateway, useClass: HttpRoutinesGateway },
    { provide: TasksGateway, useClass: HttpTasksGateway },
    { provide: BlockOutcomesGateway, useClass: HttpBlockOutcomesGateway },
    { provide: TransactionsGateway, useClass: HttpTransactionsGateway },
    { provide: FinanceReferencesGateway, useClass: HttpFinanceReferencesGateway },
    { provide: AccountStatementsGateway, useClass: HttpAccountStatementsGateway },
    { provide: IncomeSplitGateway, useClass: HttpIncomeSplitGateway },
    { provide: BillsGateway, useClass: HttpBillsGateway },
    { provide: InvestmentsGateway, useClass: HttpInvestmentsGateway },
  ],
};
