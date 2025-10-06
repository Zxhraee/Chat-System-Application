import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, fromEvent } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { User } from '../models/user';
import { Group } from '../models/group';
import { Channel } from '../models/channel';
import { ChatMessage } from '../models/message';

type SUser = {
  _id: string;
  username: string;
  email: string;
  password?: string; 
  role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';
  groups?: string[];
  createdAt?: string;
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
};

const toUser = (s: SUser): User => ({
  id: s._id,
  username: s.username,
  email: s.email,
 password: s.password ?? '',
  role: s.role,
  groups: (s.groups || []).map(String),
});

const toGroup = (s: SGroup): Group => ({
  id: s._id,
  name: s.name,
  adminIds: s.adminIds.map(String),
  createdBy: String(s.ownerId),
  channelId: [],
});

const toChannel = (s: SChannel): Channel => ({
  id: s._id,
  groupId: String(s.groupId),
  name: s.name,
  memberId: [],
});

const toMsg = (s: SMessage): ChatMessage => ({
  id: s._id,
  channelId: String(s.channelId),
  userId: String(s.senderId),
  username: s.username || s.senderId,
  text: s.body,
  timestamp: new Date(s.createdAt).getTime(),
});

type Requests = { [groupId: string]: { join: string[]; promote: string[] } };
type BanEntry = { channelId: string; userId: string };
type Bans = BanEntry[];
type Report = { channelId: string; bannerId: string; bannedId: string; reason: string; ts: number };
type Reports = Report[];

@Injectable({ providedIn: 'root' })
export class StorageService {
  private base = 'http://localhost:3000/api';

  private usersSubject = new BehaviorSubject<User[]>([]);
  private groupsSubject = new BehaviorSubject<Group[]>([]);
  public groups$ = this.groupsSubject.asObservable();
  private channelsSubject = new BehaviorSubject<Channel[]>([]);

  private usersLoaded = false;
  private groupsLoaded = false;
  private channelsLoaded = false;

  // localStorage keys 
  Keys = {
    Session: 'key_session',
    RegisterRequests: 'key_register_requests',
    Bans: 'key_bans',
    Reports: 'key_reports',
  } as const;

private socket: Socket;

constructor(private http: HttpClient) {
  // Connect to backend Socket.IO server
  this.socket = io('http://localhost:3000', {
    transports: ['websocket'],
  });

  

  // Log connection status
  this.socket.on('connect', () => console.log('🟢 Connected to Socket.IO server'));
  this.socket.on('disconnect', () => console.log('🔴 Disconnected from Socket.IO server'));

  fromEvent(this.socket, 'groups:update').subscribe(() => {
  console.log('📡 Real-time update (RxJS): Groups changed');
  this.refreshGroups();
});

fromEvent(this.socket, 'channels:update').subscribe(() => {
  console.log('📡 Real-time update (RxJS): Channels changed');
  this.refreshChannels();
});

fromEvent(this.socket, 'users:update').subscribe(() => {
  console.log('📡 Real-time update (RxJS): Users changed');
  this.refreshUsers();
});
}

  private refreshUsers(): void {
    this.http.get<SUser[]>(`${this.base}/users`).subscribe({
      next: (arr) => {
        this.usersSubject.next((arr || []).map(toUser));
        this.usersLoaded = true;
      },
      error: () => {
        this.usersSubject.next([]);
        this.usersLoaded = true;
      },
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
    this.http.patch<SUser>(`${this.base}/users/${userId}`, { role }).subscribe({
      next: (updated) => {
        const v = toUser(updated);
        this.usersSubject.next(this.usersSubject.getValue().map(u => u.id === userId ? v : u));
        observer.next(); observer.complete();
      },
      error: (e) => observer.error(e),
    });
  });
}


  private refreshGroups(): void {
  this.http.get<SGroup[]>(`${this.base}/groups`).subscribe({
    next: (arr) => {
      const groups = (arr || []).map(toGroup);
      if (JSON.stringify(groups) !== JSON.stringify(this.groupsSubject.getValue())) {
        this.groupsSubject.next(groups);
      }
      this.groupsLoaded = true;
    },
    error: (err) => {
      console.error('Error refreshing groups:', err);
    },
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
        if (!sg || sg.error) {
          console.error('Rename group failed:', sg?.error || 'Unknown error');
          observer.next(null);
          observer.complete();
          return;
        }

        const g = toGroup(sg);

const current = this.groupsSubject.getValue();
const temp = current.map(g => g.id === groupId ? { ...g, name } : g);
this.groupsSubject.next(temp);
        const updated = current.map(x => x.id === groupId ? g : x);
        this.groupsSubject.next([...updated]);
        observer.next(g);
        observer.complete();
      },
      error: (e) => {
        console.error('HTTP rename error:', e);
        observer.error(e);
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

  getGroupsForUser(userId: string): Observable<Group[]> {
  return new Observable<Group[]>((observer) => {
    const sub1 = this.getGroups().subscribe((groups) => {
      const sub2 = this.getUserById(userId).subscribe((u) => {
        if (!u) { observer.next([]); observer.complete(); return; }
observer.next(groups.filter((g) =>
  g.name === 'General' ||         
  g.createdBy === u.id ||
          (Array.isArray(g.adminIds) && g.adminIds.includes(u.id)) ||
          (Array.isArray(u.groups) && u.groups.includes(g.id))
        ));
        observer.complete();
      });
      (observer as any).add?.(() => sub2.unsubscribe());
    });
    return () => sub1.unsubscribe();
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

}removeAdminFromGroup(groupId: string, userId: string): Observable<boolean> {
  return new Observable<boolean>((observer) => {
    this.http.delete(`${this.base}/groups/${groupId}/admins/${userId}`).subscribe({
      next: () => { observer.next(true); observer.complete(); },
      error: (e) => observer.error(e),
    });
  });
}

  private refreshChannels(): void {
    this.http.get<SChannel[]>(`${this.base}/channels`).subscribe({
      next: (arr) => {
        this.channelsSubject.next((arr || []).map(toChannel));
        this.channelsLoaded = true;
      },
      error: () => {
        this.channelsSubject.next([]);
        this.channelsLoaded = true;
      },
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
          const sub2 = this.addChannel(groupId, 'main', creatorId ? [creatorId] : []).subscribe({
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


  getMessagesForChannel(channelId: string, limit = 50, beforeISO?: string): Observable<ChatMessage[]> {
    let params = new HttpParams().set('limit', String(Math.max(1, Math.min(limit, 200))));
    if (beforeISO) params = params.set('before', beforeISO);

    return new Observable<ChatMessage[]>((observer) => {
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

  sendMessage(channelId: string, authorId: string, text: string): Observable<ChatMessage | null> {
    const t = (text || '').trim();
    if (!t) return of(null);

    return new Observable<ChatMessage | null>((observer) => {
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
    return of(JSON.parse(localStorage.getItem(this.Keys.Session) || 'null'));
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

// Approve promotion
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

// Reject promotion
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


// Promote to SUPER_ADMIN manually
makeSuperAdmin(userId: string): Observable<void> {
  return new Observable<void>((observer) => {
    this.http.post(`${this.base}/users/${userId}/super`, {}).subscribe({
      next: () => observer.next(),
      error: (e) => observer.error(e),
      complete: () => observer.complete()
    });
  });
}



// Check if user is banned
isBanned(channelId: string, userId: string): Observable<boolean> {
  return new Observable<boolean>((observer) => {
    this.http.get<{ banned: boolean }>(`${this.base}/channels/${channelId}/bans/${userId}`).subscribe({
      next: (r) => observer.next(!!r.banned),
      error: () => observer.next(false),
      complete: () => observer.complete(),
    });
  });
}

// Ban user in a channel
banUser(channelId: string, userId: string): Observable<void> {
  return new Observable<void>((observer) => {
    this.http.post(`${this.base}/channels/${channelId}/bans`, { userId }).subscribe({
      next: () => observer.next(),
      error: (e) => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

// Unban user in a channel
unbanUser(channelId: string, userId: string): Observable<void> {
  return new Observable<void>((observer) => {
    this.http.delete(`${this.base}/channels/${channelId}/bans/${userId}`).subscribe({
      next: () => observer.next(),
      error: (e) => observer.error(e),
      complete: () => observer.complete(),
    });
  });
}

// Get list of banned users for a channel
getChannelBans(channelId: string): Observable<{ userId: string }[]> {
  return this.http.get<{ userId: string }[]>(`${this.base}/channels/${channelId}/bans`);
}



// Submit a ban report
reportBan(channelId: string, bannerId: string, bannedId: string, reason: string): Observable<void> {
  return new Observable<void>((observer) => {
    this.http.post(`${this.base}/reports`, { channelId, bannerId, bannedId, reason }).subscribe({
      next: () => observer.next(),
      error: (e) => observer.error(e),
      complete: () => observer.complete()
    });
  });
}

// Get all reports (super admin)
getAllReports(): Observable<any[]> {
  return this.http.get<any[]>(`${this.base}/reports`);
}
}