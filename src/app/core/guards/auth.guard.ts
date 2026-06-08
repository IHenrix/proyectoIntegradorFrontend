import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

function jwtExpirado(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const token  = auth.token();

  if (!token)                  return router.createUrlTree(['/auth']);
  if (jwtExpirado(token)) {
    auth.cerrarSesion();
    return router.createUrlTree(['/auth']);
  }
  return true;
};
