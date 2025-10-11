import { Routes, CanActivateFn } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RoleGuard } from './guards/role.guard';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { UsersComponent } from './pages/users/users.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { ChatComponent } from './pages/chat/chat.component';
import { RegisterComponent } from './pages/register/register.component'; 
import { inject } from '@angular/core';


export const mustBeLoggedIn: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

export const hasRoles: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed: string[] = (route.data?.['roles'] as string[]) || [];
  const user = auth.currentUser();
  const ok = !!user && allowed.includes(user.role);
  return ok ? true : router.createUrlTree(['/menu']); 
};

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'menu', component: MenuComponent, canActivate: [AuthGuard] },
    { path: 'users', component: UsersComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
    { path: 'groups', component: GroupsComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['GROUP_ADMIN','SUPER_ADMIN'] } },
    { path: 'chat/:groupId', component: ChatComponent },
    { path: 'chat/:groupId/:channelId', component: ChatComponent },
    { path: 'register', component: RegisterComponent },
    { path: '', pathMatch: 'full', redirectTo: 'login' },
    { path: '**', redirectTo: 'login' }
  ];
