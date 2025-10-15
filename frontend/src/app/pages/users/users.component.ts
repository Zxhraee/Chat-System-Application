import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { User } from '../../models/user';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnDestroy, OnInit {
  //Current logged in user
  current: User | null = null;
  //All users
  users: User[] = [];

  //Current user stream and all users list stream subscription
  private subCurrent?: Subscription;
  private subUsers?: Subscription;

  constructor(
    private auth: AuthService,
    private storage: StorageService,
    private router: Router
  ) {
    //subscribe to current user and user list stream
    this.subCurrent = this.storage.getCurrentUser().subscribe(u => (this.current = u));
    this.subUsers = this.storage.getUsers().subscribe(list => (this.users = list));
  }

  ngOnInit(): void {
    //Sync user from auth service
    this.current = this.auth.currentUser() || this.current;
    if (!this.current) {
      const raw = localStorage.getItem('auth_user');
      if (raw) {
        try { this.current = JSON.parse(raw); } catch { }
      }
    }
  }

  //Delete user account
  deleteMe(u: User | null): void {
    if (!u) return;
    if (!confirm(`Delete your account "${u.username}"? This cannot be undone.`)) return;

    this.storage.deleteUser(u.id).subscribe({
      next: () => {
        this.auth.logout();
        this.router.navigate(['/login']);
      },
      error: (e) => {
        console.error('delete failed', e);
        alert('Failed to delete account. Please try again.');
      }
    });
  }

  //update profile image changes to local model
  onProfileChange(event: Event, user: User) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.storage.uploadAvatar(user.id, file).subscribe({
      next: ({ avatarUrl }: { avatarUrl: string }) => {
        user.avatarUrl = avatarUrl || user.avatarUrl;
      },
      error: (err: any) => console.error('Avatar upload failed', err),
    });
  }
  //Clean up subscriptions
  ngOnDestroy() {
    this.subCurrent?.unsubscribe();
    this.subUsers?.unsubscribe();
  }
}
