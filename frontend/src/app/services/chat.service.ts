import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/message';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private streams = new Map<string, BehaviorSubject<ChatMessage[]>>();

  constructor(private store: StorageService, private auth: AuthService) {}

  //Return Message Stream for Channel
  messages$(channelId: string): Observable<ChatMessage[]> {
    let s = this.streams.get(channelId);
    if (!s) {
      s = new BehaviorSubject<ChatMessage[]>(this.store.getMessagesForChannel(channelId));
      this.streams.set(channelId, s);
    }
    return s.asObservable();
  }

  //Refresh Stream
  private refresh(channelId: string) {
    const s = this.streams.get(channelId);
    if (s) s.next(this.store.getMessagesForChannel(channelId));
  }

  //Send Message
  send(channelId: string, text: string): ChatMessage | null {
    const me = this.auth.currentUser();
    if (!me || !text.trim()) return null;
    const msg = this.store.sendMessage(channelId, me.id, text);
    if (msg) this.refresh(channelId);
    return msg;
  }

  //Fetch Message
  getMessages(channelId: string): ChatMessage[] {
    const list = this.store.getMessagesForChannel(channelId);
    this.refresh(channelId);
    return list;
  }
}
