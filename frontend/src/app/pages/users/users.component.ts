import { Component, OnDestroy } from '@angular/core';
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
export class UsersComponent implements OnDestroy {
  current: User | null = null;
  users: User[] = [];

  private subCurrent?: Subscription;
  private subUsers?: Subscription;

  constructor(
    private auth: AuthService,
    private storage: StorageService,
    private router: Router
  ) {
    this.subCurrent = this.storage.getCurrentUser().subscribe(u => (this.current = u));
    this.subUsers   = this.storage.getUsers().subscribe(list => (this.users = list));
  }

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

  ngOnDestroy() {
    this.subCurrent?.unsubscribe();
    this.subUsers?.unsubscribe();
  }
}
