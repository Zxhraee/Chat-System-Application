import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Group } from '../models/group';

const BASE = 'http://localhost:3000/api';

function idToString(x: any) {
  if (x && typeof x === 'object' && x.$oid) return x.$oid;
  return typeof x === 'string' ? x : x?.toString?.() ?? '';
}

type PromotableLite = {
  id: string;
  username: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER';
};

function toGroup(x: any): Group {
  const owner = x.ownerId ?? x.owner?._id ?? '';
  const defaultChan = x.channelId ?? x.defaultChannelId ?? x.channels?.[0]?._id ?? '';
  return {
    id: idToString(x._id ?? x.id),
    name: x.name,
    ownerId: idToString(owner),
    adminIds: (x.adminIds ?? []).map(idToString),
    memberIds: (x.memberIds ?? []).map(idToString),
    createdAt:
      typeof x.createdAt === 'string'
        ? x.createdAt
        : new Date(x.createdAt ?? Date.now()).toISOString(),
    createdBy: idToString(x.createdBy ?? owner),
    channelId: idToString(defaultChan),
  };
}

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private _groups$ = new BehaviorSubject<Group[]>([]);
  groups$ = this._groups$.asObservable();

  constructor(private http: HttpClient) {}

requestPromotion(groupId: string, userId: string, requestedBy: string) {
  return firstValueFrom(
    this.http.post<{ ok: boolean; message?: string }>(
      `${BASE}/groups/${groupId}/promotion-requests`,
      { userId, requestedBy }
    )
  );
}



async loadPromotionRequests(groupId: string): Promise<{ requests: string[] }> {
  const res = await firstValueFrom(
    this.http.get<{ requests: any[] }>(
      `${BASE}/groups/${groupId}/promotion-requests`,
      { params: { t: Date.now().toString() } } 
    )
  );
  const requests = (res?.requests ?? []).map(v =>
    v && typeof v === 'object' && '$oid' in v ? (v as any).$oid : String(v)
  );
  return { requests };
}


  approvePromotion(groupId: string, userId: string) {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(
        `${BASE}/groups/${groupId}/promotion-requests/${userId}/approve`,
        {}
      )
    );
  }

  rejectPromotion(groupId: string, userId: string) {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(
        `${BASE}/groups/${groupId}/promotion-requests/${userId}/reject`,
        {}
      )
    );
  }

  async refresh(): Promise<void> {
    const raw = await firstValueFrom(this.http.get<any[]>(`${BASE}/groups`));
    this._groups$.next((raw || []).map(toGroup));
  }

 async getPromotable(groupId: string): Promise<PromotableLite[]> {
  const raw = await firstValueFrom(
    this.http.get<any[]>(`${BASE}/groups/${groupId}/promotable`)
  );
  return (raw || []).map(u => ({
    id: (u._id?.$oid ?? u._id ?? u.id).toString(),
    username: u.username,
    email: u.email,
    role: u.role,
  }));
}


  async getById(id: string): Promise<Group | null> {
    try {
      const raw = await firstValueFrom(this.http.get<any>(`${BASE}/groups/${id}`));
      return toGroup(raw);
    } catch {
      return null;
    }
  }

  async create(name: string, ownerId: string): Promise<Group> {
    const raw = await firstValueFrom(
      this.http.post<any>(`${BASE}/groups`, { name, ownerId })
    );
    const g = toGroup(raw);
    this._groups$.next([...(this._groups$.value || []), g]);
    return g;
  }

  async join(groupId: string, userId: string): Promise<void> {
    const raw = await firstValueFrom(
      this.http.post<any>(`${BASE}/groups/${groupId}/members`, { userId })
    );
    const updated = toGroup(raw);
    const list = this._groups$.value ?? [];
    const idx = list.findIndex(g => g.id === updated.id);
    if (idx >= 0) {
      const next = list.slice();
      next[idx] = updated;
      this._groups$.next(next);
    } else {
      this._groups$.next([...list, updated]);
    }
  }

  async leave(groupId: string, userId: string, actingRole: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${BASE}/groups/${groupId}/members/${userId}`, {
        body: { actingRole },
      })
    );
    await this.refresh();
  }

  async createDefaultChannel(groupId: string): Promise<{ id: string; name: string }> {
    const raw = await firstValueFrom(
      this.http.post<any>(`${BASE}/groups/${groupId}/channels`, {
        name: 'main',
        isGlobal: true,
      })
    );
    return { id: raw._id ?? raw.id, name: raw.name };
  }

  async rename(groupId: string, newName: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${BASE}/groups/${groupId}`, { name: newName }));
    await this.refresh();
  }

  async delete(groupId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${BASE}/groups/${groupId}`));
    await this.refresh();
  }
}
