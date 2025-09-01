import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ChatMessage } from '../models/message';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  constructor() { }

  private readonly KEY = 'key_messages';
  private readonly subject = new BehaviorSubject<ChatMessage[]>(this.load());
  messages$ = this.subject.asObservable();
  
  send(data: { text: string; userId: string; username: string }): ChatMessage {
    const message: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      text: data.text,
      userId: data.userId,
      username: data.username,
    };
  
    const next: ChatMessage[] = [...this.subject.value, message];
    this.subject.next(next);
    localStorage.setItem(this.KEY, JSON.stringify(next));
    return message;
  }
  
  private load(): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
  catch { return []; }
  }
}
