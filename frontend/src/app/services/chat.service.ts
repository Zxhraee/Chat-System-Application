import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Message } from '../models/message';

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type SMessage = {
  _id: string;
  channelId: string;
  senderId: string;
  username?: string;
  body?: string;
  text?: string;
  imageUrl?: string;
  avatarUrl?: string;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiBase = environment.apiBase;
  private readonly socketBase = environment.socketBase;

  private socket!: Socket;
  private streams = new Map<string, BehaviorSubject<Message[]>>();
  private joined: string | null = null;

  private adapt(m: SMessage): Message {
    return {
      id: m._id,
      channelId: String(m.channelId),
      userId: String(m.senderId),
      username: m.username || 'User',
      text: (m.body ?? m.text ?? '').trim(),
      timestamp: new Date(m.createdAt).getTime(),
      avatarUrl: m.avatarUrl,
      imageUrl: m.imageUrl,
    };
  }
  
  async sendImageFile(channelId: string, senderId: string, file: File, username?: string) {
  // keep under your server's JSON limit (6 MB) — data URLs add ~33% overhead
  if (file.size > 4 * 1024 * 1024) throw new Error('Image too large (max ~4MB).');
  const imageDataUrl = await fileToDataURL(file);
  const payload = { userId: senderId, username, imageDataUrl };
  // toPromise for convenient await in components
  return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload).toPromise();
}

/** Send when you already have a data URL (e.g., from canvas/clipboard) */
sendImageDataUrl(channelId: string, senderId: string, imageDataUrl: string, username?: string) {
  const payload = { userId: senderId, username, imageDataUrl };
  return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload);
}
  constructor(private http: HttpClient) {
    this.socket = io(this.socketBase, { transports: ['websocket'] });

    this.socket.on('chat:message', (raw: SMessage) => {
      const msg = this.adapt(raw);                 
      const subj = this.streams.get(msg.channelId);
      if (!subj) return;
      const cur = subj.getValue();
      if (cur.some(x => x.id === msg.id)) return;
      subj.next([...cur, msg]);
    });
  }

 messages$(channelId: string): Observable<Message[]> {
  const key = String(channelId);               
  if (!this.streams.has(key)) {
    this.streams.set(key, new BehaviorSubject<Message[]>([]));
    this.loadHistory(key);
  }
  return this.streams.get(key)!.asObservable();
}

joinChannel(channelId: string, user?: { id: string; username: string } | null) {
  const key = String(channelId);
  if (this.joined && this.joined !== key) {
    this.socket.emit('chat:leave', { channelId: this.joined });
  }
  this.joined = key;
  this.socket.emit('chat:join', { channelId: key, user: user ?? null });

  if (!this.streams.has(key)) {
    this.streams.set(key, new BehaviorSubject<Message[]>([]));
    this.loadHistory(key);
  }
}


  leaveChannel(channelId: string) {
    if (this.joined === channelId) this.joined = null;
    this.socket.emit('chat:leave', { channelId });
  }

private loadHistory(channelId: string, limit = 50) {
  const key = String(channelId);
  const params = new HttpParams().set('limit', String(limit));

  this.http.get<SMessage[]>(`${this.apiBase}/channels/${key}/messages`, { params, observe: 'response' })
    .subscribe({
      next: (res: HttpResponse<SMessage[]>) => {
        if (res.status === 200 && res.body) {
          const subj = this.streams.get(key);
          if (!subj) return;
          const adapted = res.body.map(row => this.adapt(row));
          subj.next(adapted);
        }
      },
      error: (e) => console.error('loadHistory failed', e),
    });
}

  sendMessage(channelId: string, senderId: string, text: string, username?: string) {
    const payload = { userId: senderId, text, username };
    return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload);
  }
}
