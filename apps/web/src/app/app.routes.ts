import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'routines',
    loadChildren: () =>
      import('./pages/routines/routines.routes').then((module) => module.ROUTINES_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
