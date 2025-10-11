import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Message } from '../models/message';

type SMessage = {
  _id: string;
  channelId: string;   
  senderId: string;     
  username?: string;
  body?: string;
  text?: string;
  createdAt: string;    
};

const adapt = (m: SMessage): Message => ({
  id: m._id,
  channelId: String(m.channelId),
  userId: String(m.senderId),
  username: m.username || 'User',
  text: (m.body ?? m.text ?? '').trim(),
  timestamp: new Date(m.createdAt).getTime(), 
});

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiBase = environment.apiBase;   
  private readonly socketBase = environment.socketBase; 

  private socket!: Socket;

  private streams = new Map<string, BehaviorSubject<Message[]>>();
  private joined: string | null = null;

  constructor(private http: HttpClient) {
    this.socket = io(this.socketBase, { transports: ['websocket'] });

    this.socket.on('chat:message', (raw: SMessage) => {
      const msg = adapt(raw);
      const subj = this.streams.get(msg.channelId);
      if (!subj) return; 
      const cur = subj.getValue();
      if (cur.some(x => x.id === msg.id)) return; 
      subj.next([...cur, msg]);
    });

    this.socket.on('presence:join', () => {});
    this.socket.on('presence:leave', () => {});
  }

  messages$(channelId: string): Observable<Message[]> {
    if (!this.streams.has(channelId)) {
      this.streams.set(channelId, new BehaviorSubject<Message[]>([]));
      this.loadHistory(channelId);
    }
    return this.streams.get(channelId)!.asObservable();
  }

  joinChannel(channelId: string, user?: { id: string; username: string } | null) {
    if (this.joined && this.joined !== channelId) {
      this.socket.emit('chat:leave', { channelId: this.joined });
    }
    this.joined = channelId;
    this.socket.emit('chat:join', { channelId, user: user ?? null });

    if (!this.streams.has(channelId)) {
      this.streams.set(channelId, new BehaviorSubject<Message[]>([]));
      this.loadHistory(channelId);
    }
  }

  leaveChannel(channelId: string) {
    if (this.joined === channelId) this.joined = null;
    this.socket.emit('chat:leave', { channelId });
  }

  private loadHistory(channelId: string, limit = 50) {
    const params = new HttpParams().set('limit', String(limit));
    this.http.get<SMessage[]>(`${this.apiBase}/channels/${channelId}/messages`, { params })
      .subscribe({
        next: (rows) => {
          const subj = this.streams.get(channelId);
          if (!subj) return;
          subj.next((rows || []).map(adapt));
        },
        error: (e) => console.error('loadHistory failed', e),
      });
  }

  sendMessage(channelId: string, senderId: string, text: string, username?: string) {
    const payload = { userId: senderId, text, username };
    return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload);
  }
}
