import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { Steam } from './features/steam/steam';
import { Notifications } from './features/notifications/notifications';

export const routes: Routes = [
  { path: 'dashboard', component: Dashboard },
  { path: 'steam', component: Steam },
  { path: 'notifications', component: Notifications },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
