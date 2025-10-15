import { CanActivateFn } from '@angular/router';

//export AuthGuard 
export const AuthGuard: CanActivateFn = (route, state) => {
  //allow navigation for all routes and states for now
  return true;
};
