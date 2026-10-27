import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { CategoriesGateway } from './core/routines/categories-gateway';
import { GoalsGateway } from './core/routines/goals-gateway';
import { HttpCategoriesGateway } from './core/routines/http-categories-gateway';
import { HttpGoalsGateway } from './core/routines/http-goals-gateway';
import { HttpRoutinesGateway } from './core/routines/http-routines-gateway';
import { HttpTasksGateway } from './core/routines/http-tasks-gateway';
import { RoutinesGateway } from './core/routines/routines-gateway';
import { TasksGateway } from './core/routines/tasks-gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: CategoriesGateway, useClass: HttpCategoriesGateway },
    { provide: GoalsGateway, useClass: HttpGoalsGateway },
    { provide: RoutinesGateway, useClass: HttpRoutinesGateway },
    { provide: TasksGateway, useClass: HttpTasksGateway },
  ],
};
