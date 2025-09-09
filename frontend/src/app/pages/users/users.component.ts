import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { User } from '../../models/user';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  constructor(
    private auth: AuthService,
    private storage: StorageService,
    private router: Router
  ) {}

  //Get current logged in user details
  get current(): User | null {
    return this.auth.currentUser() ?? this.storage.getCurrentUser();
  }

  //Delete account
  deleteMe(): void {
    const u = this.current;
    if (!u) return;
    if (!confirm(`Delete your account "${u.username}"? This cannot be undone.`)) return;

    this.storage.deleteUser(u.id);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}