import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { User } from '../models/user';

type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private base = 'http://localhost:3000/api';

    private currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

constructor(private http: HttpClient) {
  const cached = localStorage.getItem('user');
  if (cached) {
    const u = JSON.parse(cached) as User;
    this.currentUserSubject.next(u);
  }
}



  login(username: string, password: string): Observable<User | null> {
    return this.http.post<any>(`${this.base}/auth/login`, { username, password }).pipe(
      map((res) => {
        const userPayload = res?.user ?? res;
        const token = res?.token ?? null;

        if (!userPayload?._id) return null;

        if (token) localStorage.setItem('jwt', token);
        else localStorage.removeItem('jwt');

        const user: User = {
          id: userPayload._id,
          username: userPayload.username,
          email: userPayload.email,
          password: '', 
          role: userPayload.role,
          groups: userPayload.groups || [],
        };

        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
        return user;
      }),
      catchError(() => of(null))
    );
  }

  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.getValue();
  }

  currentUser(): User | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

  currentUserId(): string | null {
    return this.currentUserSubject.getValue()?.id ?? null;
  }

  hasRole(role: Role): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && u.role === role;
  }

  hasAnyRole(...roles: Role[]): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && roles.includes(u.role as Role);
  }

  ngOnDestroy(): void {}
}