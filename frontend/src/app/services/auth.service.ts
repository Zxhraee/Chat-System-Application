import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { User } from '../models/user';

//alowed user roles
type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  //Base API URL
  private base = 'http://localhost:3000/api';

  //storage current user
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  //public observable stream of current user
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    //try to retrieve user from local storage
    const cached = localStorage.getItem('user');
    if (cached) {
      const u = JSON.parse(cached) as User;
      this.currentUserSubject.next(u);
    }
  }

  //Process user login
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
          avatarUrl: userPayload.avatarUrl || undefined,
        };

        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
        return user;
      }),
      catchError(() => of(null))
    );
  }

  //Clear authentication session
  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  //Check if user log in
  isLoggedIn(): boolean {
    return !!this.currentUserSubject.getValue();
  }

  //Retrieve cached user from storage
  currentUser(): User | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

  //User Id
  currentUserId(): string | null {
    return this.currentUserSubject.getValue()?.id ?? null;
  }

  //Check specific user role
  hasRole(role: Role): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && u.role === role;
  }

  //Check if user has any of the roles
  hasAnyRole(...roles: Role[]): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && roles.includes(u.role as Role);
  }

  //Update user profile picture
  updateAvatar(avatarUrl: string) {
    const cur = this.currentUserSubject.getValue();
    if (!cur) return;
    const updated = { ...cur, avatarUrl };
    localStorage.setItem('user', JSON.stringify(updated));
    this.currentUserSubject.next(updated);
  }
  ngOnDestroy(): void { }
}