import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';
import { ChatMessage } from '../../models/message';
import { Group } from '../../models/group';
import { Channel } from '../../models/channel'; 


@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = [];
  input = '';

  activeGroup: Group | null = null;
  activeChannelName = '';
  channels: Channel[] = [];

  private routeSub?: Subscription;
  private streamSub?: Subscription;

  groupId = '';
  channelId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chat: ChatService,
    private store: StorageService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const gid = params.get('groupId');
      let cid = params.get('channelId');
      if (!gid) return;

      this.groupId = gid;
      this.activeGroup = this.store.getGroupById(gid);
      this.channels = this.store.getChannelsByGroup(gid);

      if (!cid || cid === '_') {
        const first = this.store.getFirstChannelId(gid) ?? this.store.ensureDefaultChannel(gid).id;
        this.router.navigate(['/chat', gid, first], { replaceUrl: true });
        return;
      }

      const ch = this.store.getChannelById(cid);
      if (!ch || ch.groupId !== gid) {
        const first = this.store.getFirstChannelId(gid) ?? this.store.ensureDefaultChannel(gid).id;
        this.router.navigate(['/chat', gid, first], { replaceUrl: true });
        return;
      }

      this.channelId = cid;
      this.activeChannelName = ch.name;

      this.streamSub?.unsubscribe();
      this.streamSub = this.chat.messages$(this.channelId)
        .subscribe((list: ChatMessage[]) => (this.messages = list));
    });
  }

  goChannel(id: string) {
    if (id && id !== this.channelId) this.router.navigate(['/chat', this.groupId, id]);
  }

  send(): void {
    const text = this.input.trim();
    if (!text || !this.channelId) return;
    const sent = this.chat.send(this.channelId, text);
    if (sent) this.input = '';
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.streamSub?.unsubscribe();
  }
}