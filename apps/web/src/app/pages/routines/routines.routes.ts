import { Routes } from '@angular/router';
import { Categories } from './categories/categories';
import { CategoryDetail } from './category-detail/category-detail';
import { RoutineEditor } from './routine-editor/routine-editor';
import { RoutinesShell } from './routines-shell/routines-shell';
import { Today } from './today/today';

/** Pages of the Routines & Goals module, lazy-loaded under `/routines`. */
export const ROUTINES_ROUTES: Routes = [
  {
    path: '',
    component: RoutinesShell,
    children: [
      { path: '', component: Today, title: 'Today · Routines & Goals' },
      { path: 'routine', component: RoutineEditor, title: 'Routine · Routines & Goals' },
      { path: 'categories', component: Categories, title: 'Categories · Routines & Goals' },
      {
        path: 'categories/:categoryId',
        component: CategoryDetail,
        title: 'Category · Routines & Goals',
      },
    ],
  },
];
