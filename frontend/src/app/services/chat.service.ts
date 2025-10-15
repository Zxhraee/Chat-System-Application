import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Message } from '../models/message';

//Convert file to base64 data helper
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

//Server side message shape
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

  //Socket Io connection
  private socket!: Socket;
  //Message streams
  private streams = new Map<string, BehaviorSubject<Message[]>>();
  //Current channel id
  private joined: string | null = null;

  //Ban Deny Stream
  private deniedSubject = new BehaviorSubject<{ channelId: string; reason?: string } | null>(null);
  //Denied Observabe
  denied$: Observable<{ channelId: string; reason?: string } | null> = this.deniedSubject.asObservable();

  //Room Join Stream
  private joinedSubject = new BehaviorSubject<{ channelId: string } | null>(null);
  //Room Join Observable
  joined$: Observable<{ channelId: string } | null> = this.joinedSubject.asObservable();

  //Convert server message to client message
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

  //Post Image Message
  async sendImageFile(channelId: string, senderId: string, file: File, username?: string) {
    if (file.size > 4 * 1024 * 1024) throw new Error('Image too large (max ~4MB).');
    const imageDataUrl = await fileToDataURL(file);
    const payload = { userId: senderId, username, imageDataUrl };
    return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload).toPromise();
  }

  //Return Observable Image post
  sendImageDataUrl(channelId: string, senderId: string, imageDataUrl: string, username?: string) {
    const payload = { userId: senderId, username, imageDataUrl };
    return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload);
  }

  constructor(private http: HttpClient) {
    //socket Io connection
    this.socket = io(this.socketBase, { transports: ['websocket'] });

    //Normalise server messages and append
    this.socket.on('chat:message', (raw: SMessage) => {
      const msg = this.adapt(raw);
      const subj = this.streams.get(msg.channelId);
      if (!subj) return;
      const cur = subj.getValue();
      if (cur.some(x => x.id === msg.id)) return;
      subj.next([...cur, msg]);
    });
    //send ban and join info to stream
    this.socket.on('chat:denied', (p: any) => this.deniedSubject.next(p || null));
    this.socket.on('chat:joined', (p: any) => this.joinedSubject.next(p || null));
  }

  //observable message stream for channel
  messages$(channelId: string): Observable<Message[]> {
    const key = String(channelId);
    if (!this.streams.has(key)) {
      this.streams.set(key, new BehaviorSubject<Message[]>([]));
      this.loadHistory(key);
    }
    return this.streams.get(key)!.asObservable();
  }

  //join channel 
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

  //leave channel
  leaveChannel(channelId: string) {
    if (this.joined === channelId) this.joined = null;
    this.socket.emit('chat:leave', { channelId });
  }

  //Fetch messages
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

  //Send message 
  sendMessage(channelId: string, senderId: string, text: string, username?: string) {
    const payload = { userId: senderId, text, username };
    return this.http.post<SMessage>(`${this.apiBase}/channels/${channelId}/messages`, payload);
  }
}
