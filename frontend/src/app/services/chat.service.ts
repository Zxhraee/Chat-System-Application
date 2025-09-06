import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/message';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private _messages$ = new BehaviorSubject<ChatMessage[]>([]);
  messages$ = this._messages$.asObservable();

  private activeChannelId: string | null = null;

  constructor(private store: StorageService, private auth: AuthService) {}

  setChannel(id: string) {
    this.activeChannelId = id;
    this._messages$.next(this.store.getMessagesForChannel(id));
  }

  load(channelId?: string): ChatMessage[] {
    const id = channelId ?? this.activeChannelId;
    const list = id ? this.store.getMessagesForChannel(id) : [];
    this._messages$.next(list);
    return list;
  }

  send(args: { text: string; channelId?: string }): ChatMessage | null {
    const me = this.auth.currentUser();
    if (!me) return null;

    const id = args.channelId ?? this.activeChannelId; 
    if (!id) return null;

    const msg = this.store.sendMessage(id, me.id, args.text);
    if (msg) this._messages$.next(this.store.getMessagesForChannel(id));
    return msg;
  }

  sendMessage(id: string, text: string) { return this.send({ channelId: id, text: text }); }
  getMessages(id: string) { return this.load(id); }
}
