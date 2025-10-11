import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Message } from '../models/message';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly apiUrl = '/api/chat';
  private messagesCache = new Map<string, BehaviorSubject<Message[]>>();

  constructor(private http: HttpClient) {}


  messages$(channelId: string): Observable<Message[]> {
    if (!this.messagesCache.has(channelId)) {
      const subject = new BehaviorSubject<Message[]>([]);
      this.messagesCache.set(channelId, subject);
      this.loadMessages(channelId);
    }
    return this.messagesCache.get(channelId)!.asObservable();
  }

  private loadMessages(channelId: string): void {
    this.http.get<Message[]>(`${this.apiUrl}/${channelId}/messages`).subscribe({
      next: (msgs) => {
        const subject = this.messagesCache.get(channelId);
        if (subject) subject.next(msgs || []);
      },
      error: (err) => console.error(`Failed to load messages for ${channelId}`, err),
    });
  }

 
  sendMessage(channelId: string, senderId: string, content: string): Observable<Message> {
    const payload = { channelId, senderId, content };
    return this.http.post<Message>(`${this.apiUrl}/${channelId}/messages`, payload).pipe(
      map((msg) => {
        const subject = this.messagesCache.get(channelId);
        if (subject) {
          const current = subject.getValue();
          subject.next([...current, msg]);
        }
        return msg;
      })
    );
  }

 
  deleteMessage(channelId: string, messageId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${channelId}/messages/${messageId}`).pipe(
      map(() => {
        const subject = this.messagesCache.get(channelId);
        if (subject) {
          const updated = subject.getValue().filter((m) => m.id !== messageId);
          subject.next(updated);
        }
      })
    );
  }


  refresh(channelId: string): void {
    this.loadMessages(channelId);
  }
}
