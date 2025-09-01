import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})

export class MenuComponent {
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