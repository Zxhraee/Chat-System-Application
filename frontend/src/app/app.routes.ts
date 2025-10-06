import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { UsersComponent } from './pages/users/users.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { ChatComponent } from './pages/chat/chat.component';
import { RegisterComponent } from './pages/register/register.component'; 
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = () => {
  const session = JSON.parse(localStorage.getItem('key_session') || 'null');
  if (session?.userId) return true;
  inject(Router).navigate(['/login']);
  return false;
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
