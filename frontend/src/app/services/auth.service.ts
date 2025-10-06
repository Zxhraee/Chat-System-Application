import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { StorageService } from './storage.service';
import { User } from '../models/user';

type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  private subs: Subscription[] = [];
  private usersCache: User[] = [];
  private session: { userId: string } | null = null;

  private base = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private store: StorageService) {
    this.subs.push(
      this.store.getUsers().subscribe(users => {
        this.usersCache = users || [];
        this.recomputeCurrentUser();
      }),
      this.store.getSession().subscribe(sess => {
        this.session = sess;
        this.recomputeCurrentUser();
      }),
    );
  }

  login(username: string, password: string): Observable<User | null> {
    return new Observable<User | null>((observer) => {
      this.http.post<{ token: string; user: any }>(`${this.base}/auth/login`, { username, password })
        .subscribe({
          next: (res) => {
            try {
              localStorage.setItem('jwt', res.token);
              this.store.setSession({ userId: res.user._id }).subscribe(() => {});

              const user: User = {
                id: res.user._id,
                username: res.user.username,
                email: res.user.email,
                password: '',             
                role: res.user.role,
                groups: res.user.groups || []
              };

              localStorage.setItem('current_user_cache', JSON.stringify(user));

              this.currentUserSubject.next(user);

              observer.next(user);
              observer.complete();
            } catch (e) {
              observer.next(null);
              observer.complete();
            }
          },
          error: () => {
            observer.next(null);
            observer.complete();
          }
        });
    });
  }

  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('current_user_cache');
    this.store.setSession(null).subscribe(() => {});
    this.currentUserSubject.next(null);
  }

  currentUser(): User | null {
    const s = JSON.parse(localStorage.getItem('key_session') || 'null');
    const u = JSON.parse(localStorage.getItem('current_user_cache') || 'null');
    return s?.userId && u?.id === s.userId ? u : null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.getValue();
  }

  hasRole(role: Role): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && u.role === role;
    }

  hasAnyRole(...roles: Role[]): boolean {
    const u = this.currentUserSubject.getValue();
    return !!u && roles.includes(u.role as Role);
  }

  private recomputeCurrentUser(): void {
    const id = this.session?.userId;
    const me = id ? (this.usersCache.find(u => u.id === id) ?? null) : null;
    this.currentUserSubject.next(me);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
