import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { User } from './models/user';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Chat System';

  constructor(private auth: AuthService, private router: Router) { }

  //Currently Authenticated User
  user(): User | null {
    return this.auth.currentUser();
  }

  //Super Admin Role Validation
  isSuperAdmin(): boolean {
    const user = this.user();
    return !!user && user.role === 'SUPER_ADMIN';
  }

  //Group Admin or Super Check
  isGroupAdminorSuperAdmin(): boolean {
    const user = this.user();
    return !!user && (user.role === 'GROUP_ADMIN' || user.role === 'SUPER_ADMIN');
  }

  //Log out User and clear session and session data
  logout(): void {
    localStorage.removeItem('key_session');
    localStorage.removeItem('user');
    localStorage.removeItem('jwt');
    localStorage.removeItem('current_user_cache');

    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
