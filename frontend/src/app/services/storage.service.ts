import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, fromEvent } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { User } from '../models/user';
import { Group } from '../models/group';
import { Channel } from '../models/channel';
import { Message } from '../models/message';
import { AuthService } from './auth.service'; 
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';


const sid = (x: any): string =>
  typeof x === 'string' ? x : x?.$oid ?? x?.toString?.() ?? '';

type SUser = {
  _id: string;
  username: string;
  email: string;
  password?: string;
  role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';
  groups?: string[];
  createdAt?: string;
  avatarUrl?: string;
};

type SGroup = {
  _id: string;
  name: string;
  ownerId: string;
  adminIds: string[];
  memberIds: string[];
  createdAt?: string;
};

type SChannel = {
  _id: string;
  groupId: string;
  name: string;
  isGlobal?: boolean;
  createdAt?: string;
};

type SMessage = {
  _id: string;
  channelId: string;
  senderId: string;
  username?: string;
  body: string;
  meta?: any;
  createdAt: string;
  avatarUrl?: string;
  imageUrl?: string;
};

const toUser = (s: SUser): User => ({
  id: sid(s._id),
  username: s.username,
  email: s.email,
  password: s.password ?? '',
  role: s.role,
  groups: (s.groups || []).map(sid),
  avatarUrl: s.avatarUrl,
});

const toGroup = (s: any): Group => ({
  id: sid(s._id),
  name: s.name,
  ownerId: sid(s.ownerId),
  adminIds: (s.adminIds || []).map(sid),
  memberIds: (s.memberIds || []).map(sid),
  createdAt: s.createdAt,
  createdBy: sid(s.ownerId),
});


const toChannel = (s: SChannel): Channel => ({
  id: sid(s._id),
  groupId: sid(s.groupId),
  name: s.name,
  memberIds: [],
});

const toMsg = (s: SMessage): Message => ({
  id: sid(s._id),
  channelId: sid(s.channelId),
  userId: sid(s.senderId),
  username: s.username || sid(s.senderId),
  text: s.body,
  timestamp: new Date(s.createdAt).getTime(),
  avatarUrl: s.avatarUrl,  
  imageUrl: (s as any).imageUrl 
});


type Requests = { [groupId: string]: { join: string[]; promote: string[] } };
type BanEntry = { channelId: string; userId: string };
type Bans = BanEntry[];
type Report = { channelId: string; bannerId: string; bannedId: string; reason: string; ts: number };
type Reports = Report[];


@Injectable({ providedIn: 'root' })
export class StorageService {
  private base = 'http://localhost:3000/api';

  private usersSubject = new BehaviorSubject<User[]>(
    JSON.parse(localStorage.getItem('cache_users') || '[]')
  );
  private groupsSubject = new BehaviorSubject<Group[]>(
    JSON.parse(localStorage.getItem('cache_groups') || '[]')
  );
  private channelsSubject = new BehaviorSubject<Channel[]>(
    JSON.parse(localStorage.getItem('cache_channels') || '[]')
  );
  public groups$ = this.groupsSubject.asObservable();

  private usersLoaded = false;
  private groupsLoaded = false;
  private channelsLoaded = false;
private userGroupsStreams = new Map<string, BehaviorSubject<Group[]>>();


  Keys = {
    Session: 'key_session',
    RegisterRequests: 'key_register_requests',
    Bans: 'key_bans',
    Reports: 'key_reports',
  } as const;

  private socket: Socket;

  constructor(private http: HttpClient, private auth: AuthService) {


    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
    });




    this.socket.on('connect', () => console.log('Connected to Socket.IO server'));
    this.socket.on('disconnect', () => console.log('Disconnected from Socket.IO server'));

    fromEvent(this.socket, 'groups:update').subscribe(() => {
      this.refreshGroups();
    });

    fromEvent(this.socket, 'channels:update').subscribe(() => {
      this.refreshChannels();
    });

    fromEvent(this.socket, 'users:update').subscribe(() => {
      this.refreshUsers();
    });
  }

  private refreshUsers(): void {
  this.http.get<SUser[]>(`${this.base}/users`, { observe: 'response' })
    .subscribe({
      next: (res: HttpResponse<SUser[]>) => {
        if (res.status === 200 && res.body) {
          const users = res.body.map(toUser);
          this.usersSubject.next(users);
          localStorage.setItem('cache_users', JSON.stringify(users));
        }
        this.usersLoaded = true; 
        
      },
      error: () => { this.usersLoaded = true; } 
      
    });
}



  getUsers(): Observable<User[]> {
    if (!this.usersLoaded) this.refreshUsers();
    return this.usersSubject.asObservable();
  }

  getUserById(id: string): Observable<User | undefined> {
    return new Observable<User | undefined>((observer) => {
      const sub = this.getUsers().subscribe((list) => {
        observer.next(list.find((u) => u.id === id));
        observer.complete();
      });
      return () => sub.unsubscribe();
    });
  }

  getUserByUsername(username: string): Observable<User | undefined> {
    const u = (username || '').trim().toLowerCase();
    return new Observable<User | undefined>((observer) => {
      const sub = this.getUsers().subscribe((list) => {
        observer.next(list.find((x) => x.username.toLowerCase() === u));
        observer.complete();
      });
      return () => sub.unsubscribe();
    });
  }

  createUser(username: string, email: string, password: string): Observable<User | null> {
    username = (username || '').trim();
    if (!username || !email?.trim() || !password?.trim()) return of(null);

    return new Observable<User | null>((observer) => {
      this.http.post<SUser>(`${this.base}/users`, { username, email, password, role: 'USER' }).subscribe({
        next: (created) => {
          const user = toUser(created);
          this.usersSubject.next([...this.usersSubject.getValue(), user]);
          observer.next(user);
          observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }

uploadAvatar(userId: string, file: File) {
  const toDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  return new Observable<{ avatarUrl: string }>((observer) => {
    toDataUrl(file).then((dataUrl) => {
      this.http.post<{ avatarUrl: string }>(`${this.base}/users/${userId}/avatar-data`, { dataUrl })
        .subscribe({
          next: (res) => {
            const url = res?.avatarUrl || '';

            const updated = this.usersSubject.getValue().map(u =>
              u.id === userId ? { ...u, avatarUrl: url } : u
            );
            this.usersSubject.next(updated);
            localStorage.setItem('cache_users', JSON.stringify(updated));

            if (this.auth.currentUserId() === userId && url) {
              this.auth.updateAvatar(url);
            }

            observer.next({ avatarUrl: url });
            observer.complete();
          },
          error: (e) => observer.error(e),
        });
    }).catch((e) => observer.error(e));
  });
}

private loadGroupsForUser(userId: string): void {
  const uid = sid(userId);
  const cacheKey = `cache_user_groups_${uid}`;
  const subj = this.userGroupsStreams.get(uid)!; 

  const params = new HttpParams().set('limit', '9999');
  this.http.get<SGroup[]>(`${this.base}/users/${uid}/groups`, { observe: 'response', params })
    .subscribe({
      next: (res) => {
        if (res.status === 200 && res.body) {
          const fresh = res.body.map(toGroup);
          localStorage.setItem(cacheKey, JSON.stringify(fresh));
          subj.next(fresh);
        }
      },
      error: (e) => {
        console.error('loadGroupsForUser failed', e);
      }
    });
}

getGroupsForUser(userId: string): Observable<Group[]> {
  const uid = sid(userId);
  const cacheKey = `cache_user_groups_${uid}`;

  if (!this.userGroupsStreams.has(uid)) {
    const seeded =
      JSON.parse(localStorage.getItem(cacheKey) || 'null') ??
      this.groupsSubject.getValue().filter(g => g.memberIds.includes(uid));

    this.userGroupsStreams.set(uid, new BehaviorSubject<Group[]>(seeded || []));
    this.loadGroupsForUser(uid);
  }

  return this.userGroupsStreams.get(uid)!.asObservable();
}


  deleteUser(userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.delete(`${this.base}/users/${userId}`).subscribe({
        next: () => {
          this.usersSubject.next(this.usersSubject.getValue().filter(u => u.id !== userId));
          observer.next(true); observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }

  setUserRole(userId: string, role: User['role']): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.patch<any>(`${this.base}/users/${userId}`, { role }).subscribe({
        next: (updated) => {
          if (updated && (updated._id || updated.id)) {
            const v = toUser(updated as SUser);
            this.usersSubject.next(this.usersSubject.getValue().map(u => u.id === userId ? v : u));
          } else {
            this.refreshUsers();
          }
          observer.next(); observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }

  onGroupsUpdated(cb: () => void) {
    fromEvent(this.socket, 'groups:update').subscribe(cb);
  }



private refreshGroups(): void {
  this.http.get<SGroup[]>(`${this.base}/groups`, { observe: 'response' })
    .subscribe({
      next: (res: HttpResponse<SGroup[]>) => {
        if (res.status === 200 && res.body) {
          const groups = res.body.map(toGroup);
          this.groupsSubject.next(groups);
          localStorage.setItem('cache_groups', JSON.stringify(groups));
        }
        this.groupsLoaded = true;
      },
      error: () => { this.groupsLoaded = true; }
    });
}



  getGroups(): Observable<Group[]> {
    if (!this.groupsLoaded) this.refreshGroups();
    return this.groupsSubject.asObservable();
  }

  getAllGroups(): Observable<Group[]> {
    return this.getGroups();
  }

  getGroupById(id: string): Observable<Group | null> {
    return new Observable<Group | null>((observer) => {
      const sub = this.getGroups().subscribe((gs) => {
        observer.next(gs.find((g) => g.id === id) ?? null);
        observer.complete();
      });
      return () => sub.unsubscribe();
    });
  }

  addGroup(name: string, creatorId: string): Observable<{ group: Group; firstChannel: Channel }> {
    return new Observable<{ group: Group; firstChannel: Channel }>((observer) => {
      this.http.post<SGroup>(`${this.base}/groups`, { name, ownerId: creatorId }).subscribe({
        next: (sg) => {
          const group = toGroup(sg);
          this.groupsSubject.next([...this.groupsSubject.getValue(), group]);

          const sub = this.ensureDefaultChannel(group.id, creatorId).subscribe({
            next: (firstChannel) => {
              observer.next({ group, firstChannel });
              observer.complete();
            },
            error: (e) => observer.error(e),
          });
          (observer as any).add?.(() => sub.unsubscribe());
        },
        error: (e) => observer.error(e),
      });
    });
  }

  renameGroup(groupId: string, name: string): Observable<Group | null> {
    return new Observable<Group | null>((observer) => {
      this.http.patch<any>(`${this.base}/groups/${groupId}`, { name }).subscribe({
        next: (sg) => {

          const g = toGroup(sg);

          const current = this.groupsSubject.getValue();
          const temp = current.map(g => g.id === groupId ? { ...g, name } : g);
          this.groupsSubject.next(temp);
          const updated = current.map(x => x.id === groupId ? g : x);
          this.groupsSubject.next([...updated]);
          observer.next(g);
          observer.complete();
        },
      });
    });
  }

  deleteGroup(groupId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.delete(`${this.base}/groups/${groupId}`).subscribe({
        next: () => {
          this.groupsSubject.next(this.groupsSubject.getValue().filter(g => g.id !== groupId));
          observer.next(true); observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }

  addUserToGroup(groupId: string, userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.post(`${this.base}/groups/${groupId}/members`, { userId }).subscribe({
        next: () => { observer.next(true); observer.complete(); },
        error: (e) => observer.error(e),
      });
    });
  }


  removeUserFromGroup(groupId: string, userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.delete(`${this.base}/groups/${groupId}/members/${userId}`).subscribe({
        next: () => { observer.next(true); observer.complete(); },
        error: (e) => observer.error(e),
      });
    });
  }

  addAdminToGroup(groupId: string, userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.post(`${this.base}/groups/${groupId}/admins`, { userId }).subscribe({
        next: () => { observer.next(true); observer.complete(); },
        error: (e) => observer.error(e),
      });
    });

  } removeAdminFromGroup(groupId: string, userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.delete(`${this.base}/groups/${groupId}/admins/${userId}`).subscribe({
        next: () => { observer.next(true); observer.complete(); },
        error: (e) => observer.error(e),
      });
    });
  }

private refreshChannels(): void {
  const params = new HttpParams().set('t', Date.now().toString());
  const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };

  this.http.get<SChannel[]>(`${this.base}/channels`, { params, headers }).subscribe({
    next: (arr) => {
      const chans = (arr || []).map(toChannel);
      this.channelsSubject.next(chans);
      localStorage.setItem('cache_channels', JSON.stringify(chans));
      this.channelsLoaded = true;
    },
    error: () => { this.channelsLoaded = true; }
  });
}


  getChannels(): Observable<Channel[]> {
    if (!this.channelsLoaded) this.refreshChannels();
    return this.channelsSubject.asObservable();
  }

  getChannelById(id: string): Observable<Channel | null> {
    return new Observable<Channel | null>((observer) => {
      const sub = this.getChannels().subscribe((chs) => {
        observer.next(chs.find((c) => c.id === id) ?? null);
        observer.complete();
      });
      return () => sub.unsubscribe();
    });
  }

  getChannelsByGroup(groupId: string): Observable<Channel[]> {
    return new Observable<Channel[]>((observer) => {
      const sub = this.getChannels().subscribe((chs) => {
        observer.next(chs.filter((c) => c.groupId === groupId));
        observer.complete();
      });
      return () => sub.unsubscribe();
    });
  }

  addChannel(groupId: string, name = 'main', _memberIds: string[] = []): Observable<Channel> {
    return new Observable<Channel>((observer) => {
      this.http.post<SChannel>(`${this.base}/channels`, { groupId, name }).subscribe({
        next: (sc) => {
          const ch = toChannel(sc);
          this.channelsSubject.next([...this.channelsSubject.getValue(), ch]);
          observer.next(ch);
          observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }

  ensureDefaultChannel(groupId: string, creatorId?: string): Observable<Channel> {
    return new Observable<Channel>((observer) => {
      const sub = this.getChannelsByGroup(groupId).subscribe((existing) => {
        if (existing.length) {
          observer.next(existing[0]);
          observer.complete();
        } else {
          const sub2 = this.addChannel(groupId, 'Main', creatorId ? [creatorId] : []).subscribe({
            next: (ch) => {
              observer.next(ch);
              observer.complete();
            },
            error: (e) => observer.error(e),
          });
          (observer as any).add?.(() => sub2.unsubscribe());
        }
      });
      return () => sub.unsubscribe();
    });
  }

  deleteChannel(channelId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.delete(`${this.base}/channels/${channelId}`).subscribe({
        next: () => {
          this.channelsSubject.next(this.channelsSubject.getValue().filter(c => c.id !== channelId));
          observer.next(true); observer.complete();
        },
        error: (e) => observer.error(e),
      });
    });
  }


  getMessagesForChannel(channelId: string, limit = 50, beforeISO?: string): Observable<Message[]> {
    let params = new HttpParams().set('limit', String(Math.max(1, Math.min(limit, 200))));
    if (beforeISO) params = params.set('before', beforeISO);

    return new Observable<Message[]>((observer) => {
      this.http
        .get<SMessage[]>(`${this.base}/channels/${channelId}/messages`, { params })
        .subscribe({
          next: (arr) => {
            observer.next((arr || []).map(toMsg));
            observer.complete();
          },
          error: (e) => observer.error(e),
        });
    });
  }

  sendMessage(channelId: string, authorId: string, text: string): Observable<Message | null> {
    const t = (text || '').trim();
    if (!t) return of(null);

    return new Observable<Message | null>((observer) => {
      const sub = this.getUserById(authorId).subscribe((u) => {
        const payload = { userId: authorId, username: u?.username ?? authorId, text: t };
        this.http.post<SMessage>(`${this.base}/channels/${channelId}/messages`, payload).subscribe({
          next: (sm) => {
            observer.next(toMsg(sm));
            observer.complete();
          },
          error: (e) => observer.error(e),
        });
      });
      return () => sub.unsubscribe();
    });
  }


  getSession(): Observable<{ userId: string } | null> {
    try {
      const ls = localStorage;
      const s = JSON.parse(ls.getItem(this.Keys.Session) || 'null');
      const u = JSON.parse(ls.getItem('user') || 'null');
      const token = ls.getItem('jwt') || '';
      const idFromToken = token.startsWith('session_') ? token.slice('session_'.length) : null;

      const ids = [s?.userId, u?.id, idFromToken].filter(Boolean);
      const userId = ids[0] || null;

      if (userId && s?.userId !== userId) {
        ls.setItem(this.Keys.Session, JSON.stringify({ userId }));
      }

      return of(userId ? { userId } : null);
    } catch {
      return of(null);
    }
  }

  setSession(v: { userId: string } | null): Observable<void> {
    localStorage.setItem(this.Keys.Session, JSON.stringify(v));
    return of(void 0);
  }

  getCurrentUser(): Observable<User | null> {
    return new Observable<User | null>((observer) => {
      const sub = this.getSession().subscribe((s) => {
        if (!s?.userId) {
          observer.next(null);
          observer.complete();
        } else {
          const sub2 = this.getUserById(s.userId).subscribe((u) => {
            observer.next(u ?? null);
            observer.complete();
          });
          (observer as any).add?.(() => sub2.unsubscribe());
        }
      });
      return () => sub.unsubscribe();
    });
  }


  private getRequests(): Requests {
    return JSON.parse(localStorage.getItem(this.Keys.RegisterRequests) || '{}');
  }
  private setRequests(v: Requests) {
    localStorage.setItem(this.Keys.RegisterRequests, JSON.stringify(v));
  }

  requestJoinGroup(groupId: string, userId: string): Observable<void> {
    const req = this.getRequests();
    req[groupId] ||= { join: [], promote: [] };
    if (!req[groupId].join.includes(userId)) req[groupId].join.push(userId);
    this.setRequests(req);
    return of(void 0);
  }
  getJoinRequests(groupId: string): Observable<string[]> {
    const req = this.getRequests();
    return of(req[groupId]?.join ?? []);
  }
  approveJoin(groupId: string, userId: string): Observable<void> {
    const req = this.getRequests();
    if (req[groupId]) req[groupId].join = req[groupId].join.filter((id) => id !== userId);
    this.setRequests(req);
    return of(void 0);
  }
  rejectJoin(groupId: string, userId: string): Observable<void> {
    const req = this.getRequests();
    if (req[groupId]) req[groupId].join = req[groupId].join.filter((id) => id !== userId);
    this.setRequests(req);
    return of(void 0);
  }


  requestPromotion(groupIdOrUserId: string, maybeUserId?: string): Observable<void> {
    const userId = maybeUserId ?? groupIdOrUserId;
    return new Observable<void>((observer) => {
      this.http.post(`${this.base}/users/${userId}/request-promotion`, {}).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete()
      });
    });
  }

  approvePromotion(groupIdOrUserId: string, maybeUserId?: string): Observable<void> {
    const userId = maybeUserId ?? groupIdOrUserId;
    return new Observable<void>((observer) => {
      this.http.post(`${this.base}/users/${userId}/promote`, {}).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete()
      });
    });
  }

  rejectPromotion(groupIdOrUserId: string, maybeUserId?: string): Observable<void> {
    const userId = maybeUserId ?? groupIdOrUserId;
    return new Observable<void>((observer) => {
      this.http.patch(`${this.base}/users/${userId}`, { promotionRequested: false }).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete()
      });
    });
  }


  getPromotionRequests(groupId: string): Observable<string[]> {
    return of([]);
  }


  makeSuperAdmin(userId: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.post(`${this.base}/users/${userId}/super`, {}).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete()
      });
    });
  }



  isBanned(channelId: string, userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.http.get<{ banned: boolean }>(`${this.base}/channels/${channelId}/bans/${userId}`).subscribe({
        next: (r) => observer.next(!!r.banned),
        error: () => observer.next(false),
        complete: () => observer.complete(),
      });
    });
  }

  banUser(channelId: string, userId: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.post(`${this.base}/channels/${channelId}/bans`, { userId }).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete(),
      });
    });
  }

  unbanUser(channelId: string, userId: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.delete(`${this.base}/channels/${channelId}/bans/${userId}`).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete(),
      });
    });
  }

  getChannelBans(channelId: string): Observable<{ userId: string }[]> {
    return this.http.get<{ userId: string }[]>(`${this.base}/channels/${channelId}/bans`);
  }



  reportBan(channelId: string, bannerId: string, bannedId: string, reason: string): Observable<void> {
    return new Observable<void>((observer) => {
      this.http.post(`${this.base}/reports`, { channelId, bannerId, bannedId, reason }).subscribe({
        next: () => observer.next(),
        error: (e) => observer.error(e),
        complete: () => observer.complete()
      });
    });
  }

  getAllReports(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/reports`);
  }
}