import { CanActivateFn } from '@angular/router';

export const RoleGuard: CanActivateFn = (route, state) => {
  return true;
};
