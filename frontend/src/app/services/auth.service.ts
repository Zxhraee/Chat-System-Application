import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { User } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private store: StorageService) { }

  login(username: string, password: string): User | null {
    const user = this.store.getUsers().find((u: User) =>
      u.username === username && u.password === password
    );
    if (!user) return null;
    this.store.setSession({ userId: user.id });
    return user;
  }

  logout(): void {
    this.store.setSession(null);
  }

  currentUser(): User | null {
    const s = this.store.getSession();
    if (!s) return null;
    return this.store.getUsers().find((u: User) => u.id === s.userId) ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  hasRole(role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER'): boolean {
    const u = this.currentUser();
    return !!u && u.role === role;
  }

  hasAnyRole(...roles: Array<'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER'>): boolean {
    const u = this.currentUser();
    return !!u && roles.includes(u.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER');
  }
}