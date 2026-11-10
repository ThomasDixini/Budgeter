import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Login } from './pages/login/login';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Orbit' },
  { path: 'login', component: Login, title: 'Sign in · Orbit' },
  {
    path: 'routines',
    loadChildren: () =>
      import('./pages/routines/routines.routes').then((module) => module.ROUTINES_ROUTES),
  },
  {
    path: 'finances',
    loadChildren: () =>
      import('./pages/finances/finances.routes').then((module) => module.FINANCES_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
