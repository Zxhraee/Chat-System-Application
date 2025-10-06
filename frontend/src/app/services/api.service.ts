import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { User } from '../models/user';
import { Group } from '../models/group';
import { Channel } from '../models/channel';
import { ChatMessage } from '../models/message';
import {
  SUser, SGroup, SChannel, SMessage,
  mapUser, mapGroup, mapChannel, mapMessage
} from './mappers';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  health(): Observable<{ ok: boolean; db: string; ts: number }> {
    return this.http.get<{ ok: boolean; db: string; ts: number }>(`${this.base}/health`);
  }

  getUsers(): Observable<User[]> {
    return this.http.get<SUser[]>(`${this.base}/users`).pipe(map(arr => arr.map(mapUser)));
  }

  createUser(username: string, email: string, role: User['role'] = 'USER'): Observable<User> {
    return this.http.post<SUser>(`${this.base}/users`, { username, email, role })
      .pipe(map(mapUser));
  }


  getGroups(): Observable<Group[]> {
    return this.http.get<SGroup[]>(`${this.base}/groups`).pipe(map(arr => arr.map(mapGroup)));
  }

  addGroup(name: string, ownerId: string): Observable<Group> {
    return this.http.post<SGroup>(`${this.base}/groups`, { name, ownerId })
      .pipe(map(mapGroup));
  }

  getChannels(): Observable<Channel[]> {
    return this.http.get<SChannel[]>(`${this.base}/channels`).pipe(map(arr => arr.map(mapChannel)));
  }

  addChannel(groupId: string, name: string, isGlobal = false): Observable<Channel> {
    return this.http.post<SChannel>(`${this.base}/channels`, { groupId, name, isGlobal })
      .pipe(map(mapChannel));
  }

  getMessagesForChannel(channelId: string, limit = 50, beforeISO?: string): Observable<ChatMessage[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (beforeISO) params = params.set('before', beforeISO);
    return this.http.get<SMessage[]>(`${this.base}/messages/${channelId}`, { params })
      .pipe(map(arr => arr.map(mapMessage)));
  }

  sendMessage(channelId: string, userId: string, username: string, text: string): Observable<ChatMessage> {
    return this.http.post<SMessage>(`${this.base}/channels/${channelId}/messages`, {
      userId, username, text
    }).pipe(map(mapMessage));
  }
}
