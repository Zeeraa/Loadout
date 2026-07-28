import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { provideToastService } from 'ngx-yet-another-toast-library';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideToastService({
      defaultOptions: {
        progressBar: true,
      },
      position: 'top-right',
      newestOnTop: true,
    }),
    importProvidersFrom(NgbModule),
  ],
};
