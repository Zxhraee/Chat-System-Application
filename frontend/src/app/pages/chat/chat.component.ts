import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { ChatMessage } from '../../models/message';
import { Group } from '../../models/group';
import { StorageService } from '../../services/storage.service';


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
  activeGroup: Group | null = null;
  activeChannelName = '';
  private routeSub?: Subscription;
  private streamSub?: Subscription;
  groupId = '';
  channelId = '';

  constructor(private route: ActivatedRoute, private chat: ChatService, private store: StorageService,) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const cid = params.get('channelId');
      if (!cid) return;

      this.channelId = cid;

      this.streamSub?.unsubscribe();
      this.streamSub = this.chat
        .messages$(this.channelId)
        .subscribe((list: ChatMessage[]) => (this.messages = list));
    });
  }

  send(): void {
    const text = this.input.trim();
    if (!text) return;
    const sent = this.chat.send(this.channelId, text);
    if (sent) this.input = '';
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.streamSub?.unsubscribe();
  }
}
