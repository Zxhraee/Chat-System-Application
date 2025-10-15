import { CanActivateFn } from '@angular/router';

//export roleguard 
export const RoleGuard: CanActivateFn = (route, state) => {
  //allow navigation for all routes and states for now
  return true;
};
