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

  constructor(private auth: AuthService, private router: Router) {}

  user(): User | null {
    return this.auth.currentUser();
  }

  isSuperAdmin(): boolean {
    const user = this.user();
    return !!user && user.role === 'SUPER_ADMIN';
  }

  isGroupAdminorSuperAdmin(): boolean {
    const user = this.user();
    return !!user && (user.role === 'GROUP_ADMIN' || user.role === 'SUPER_ADMIN');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
