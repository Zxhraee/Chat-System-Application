import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { UsersComponent } from './pages/users/users.component';
import { GroupsComponent } from './pages/groups/groups.component';
import { ChannelsComponent } from './pages/channels/channels.component';
import { ChatComponent } from './pages/chat/chat.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'menu', component: MenuComponent, canActivate: [AuthGuard] },
    { path: 'users', component: UsersComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER'] } },
    { path: 'groups', component: GroupsComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['GROUP_ADMIN','SUPER'] } },
    { path: 'groups/:id/channels', component: ChannelsComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['GROUP_ADMIN','SUPER'] } },
    { path: 'chat/:groupId/:channelId', component: ChatComponent, canActivate: [AuthGuard] },
    { path: '', pathMatch: 'full', redirectTo: 'login' },
    { path: '**', redirectTo: 'login' }
  ];
