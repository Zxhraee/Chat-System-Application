import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';
import { ChatMessage } from '../../models/message';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = [];
  input = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private chat: ChatService,
    private store: StorageService
  ) {}

  ngOnInit(): void {
    this.sub = this.chat.messages$.subscribe(list => (this.messages = list));

    const groupId = this.route.snapshot.paramMap.get('groupId')!;
    const channelId = this.route.snapshot.paramMap.get('channelId')!;

    this.chat.setChannel(channelId);
    this.chat.load(channelId);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  send(): void {
    const text = this.input.trim();
    if (!text) return;
    this.chat.send({ text });
    this.input = '';
  }
}
