import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Channel } from '../models/channel';

//Base API URL
const BASE = 'http://localhost:3000/api';

//Normalise ids to string
function idToString(x: any): string {
  if (x && typeof x === 'object' && x.$oid) return x.$oid;
  return typeof x === 'string' ? x : x?.toString?.() ?? '';
}

@Injectable({ providedIn: 'root' })
export class ChannelsService {
  constructor(private http: HttpClient) { }

  //get channels
  async list(groupId: string): Promise<Channel[]> {
    const raw = await firstValueFrom(this.http.get<any[]>(`${BASE}/groups/${groupId}/channels`));
    //Map server results to channel shape
    const list = (raw || []).map(x => ({
      id: String(x._id ?? x.id),
      groupId: String(x.groupId ?? x.group?._id ?? x.groupId),
      name: x.name,
      isGlobal: !!x.isGlobal,
      memberIds: (x.memberIds || []).map(String),
      createdAt: x.createdAt,
    }));

    //Retrieve current session user id and filter channels 
    const me = localStorage.getItem('session_user_id');
    return me ? list.filter(c => (c.memberIds || []).includes(me)) : list;
  }


  //Create channels
  async create(groupId: string, name: string, isGlobal = false): Promise<Channel> {
    const raw = await firstValueFrom(
      this.http.post<any>(`${BASE}/groups/${groupId}/channels`, { name, isGlobal })
    );
    return {
      id: idToString(raw._id ?? raw.id),
      groupId: idToString(raw.groupId ?? raw.group?._id ?? raw.groupId),
      name: raw.name,
      isGlobal: !!raw.isGlobal,
      createdAt: typeof raw.createdAt === 'string'
        ? raw.createdAt
        : new Date(raw.createdAt ?? Date.now()).toISOString(),
    };
  }

  //Delete channel
  async delete(channelId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${BASE}/channels/${idToString(channelId)}`));
  }
}