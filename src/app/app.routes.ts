import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { Steam } from './features/steam/steam';
import { Notifications } from './features/notifications/notifications';
import { UpdateStatus } from './features/update-status/update-status';
import { Settings } from './features/settings/settings';

export const routes: Routes = [
  { path: 'dashboard', component: Dashboard },
  { path: 'steam', component: Steam },
  { path: 'notifications', component: Notifications },
  { path: 'settings', component: Settings },
  { path: 'update-status', component: UpdateStatus },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
