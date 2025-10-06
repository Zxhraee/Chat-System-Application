import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/message';
import { HttpClient } from '@angular/common/http';


interface SMessage {
  _id: string;
  channelId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private streams = new Map<string, BehaviorSubject<ChatMessage[]>>();
  private base = 'http://localhost:3000/api';
 constructor(
    private store: StorageService,
    private auth: AuthService,
    private http: HttpClient
  ) {}

  private mapMsg(m: SMessage): ChatMessage {
    return {
      id: m._id,
      channelId: m.channelId,
      userId: m.userId,
      username: m.username,
      text: m.text,
      timestamp: m.timestamp,
    };
  }
 
   private ensureStream(channelId: string): BehaviorSubject<ChatMessage[]> {
    let s = this.streams.get(channelId);
    if (!s) {
      s = new BehaviorSubject<ChatMessage[]>([]);
      this.streams.set(channelId, s);
      // initial fetch
      this.http.get<SMessage[]>(`${this.base}/channels/${channelId}/messages`)
        .subscribe(list => {
          const mapped = (list || []).map(m => this.mapMsg(m));
          s!.next(mapped);
        });
    }
    return s;
  }

  //Return Message Stream for Channel
   messages$(channelId: string): Observable<ChatMessage[]> {
    return this.ensureStream(channelId).asObservable();
  }

  //Refresh Stream
  private refresh(channelId: string): void {
    const s = this.streams.get(channelId);
    if (!s) return;
    this.http.get<SMessage[]>(`${this.base}/channels/${channelId}/messages`)
      .subscribe(list => {
        const mapped = (list || []).map(m => this.mapMsg(m));
        s.next(mapped);
      });
  }

  //Send Message
   send(channelId: string, text: string): Observable<ChatMessage | null> {
    const me = this.auth.currentUser();
    const body = {
      userId: me?.id || '',
      username: me?.username || '',
      text: text
    };

    return new Observable<ChatMessage | null>(subscriber => {
      this.http.post<SMessage>(`${this.base}/channels/${channelId}/messages`, body)
        .subscribe({
          next: (server) => {
            const msg = this.mapMsg(server);
            const s = this.ensureStream(channelId);
            const current = s.getValue();
            s.next([...current, msg]);
            subscriber.next(msg);
            subscriber.complete();
          },
          error: (err) => subscriber.error(err),
        });
    });
  }
}