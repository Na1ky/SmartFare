import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AlertService } from '../services/alert.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const alertService = inject(AlertService);

  if (authService.IsAuthenticated()) {
    return true;
  }

  alertService.show('Devi effettuare il login per accedere a questa funzione.');

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
