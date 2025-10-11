import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, Observable, of } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';
import { Message } from '../../models/message';
import { Group } from '../../models/group';
import { Channel } from '../../models/channel'; 
import { User } from '../../models/user';


@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  me: User | null = null;
  input = '';

  messages$: Observable<Message[]> = of([]);

  activeGroup: Group | null = null;
  activeChannelName = '';
  channels: Channel[] = [];

  groupId = '';
  channelId = '';

  private subRoute?: Subscription;
  private subGroup?: Subscription;
  private subChans?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chat: ChatService,
    private store: StorageService
  ) {}

  
  ngOnInit(): void {
    this.subRoute = this.route.paramMap.subscribe(params => {
        const gid = this.route.snapshot.paramMap.get('groupId')!;
  const cid = this.route.snapshot.paramMap.get('channelId');

  if (!cid) {
    this.store.ensureDefaultChannel(gid).subscribe(ch => {
      this.router.navigate(['/chat', gid, ch.id]);
    });
    return;
  }
      this.groupId = gid;

      this.subGroup?.unsubscribe();
      this.subGroup = this.store.getGroupById(gid).subscribe(g => {
        this.activeGroup = g;

        this.subChans?.unsubscribe();
        this.subChans = this.store.getChannelsByGroup(gid).subscribe(chs => {
          this.channels = chs || [];

          const byParam = this.channels.find(c => c.id === cid);
          const chosen = byParam?.id || this.channels[0]?.id || '';

          if (!chosen) {
            this.store.ensureDefaultChannel(gid).subscribe(created => {
              this.store.getChannelsByGroup(gid).subscribe(chs2 => {
                this.channels = chs2 || [];
                this.setActiveChannel(this.channels[0]?.id || '');
              });
            });
          } else {
            this.setActiveChannel(chosen);
          }
        });
      });
    });
  }

  private setActiveChannel(id: string) {
    if (!id) return;
    this.channelId = id;
    const ch = this.channels.find(c => c.id === id);
    this.activeChannelName = ch?.name || '';
    this.messages$ = this.chat.messages$(id);
  }

  goChannel(id: string) {
    if (id && id !== this.channelId) this.router.navigate(['/chat', this.groupId, id]);
  }

  send(): void {
  const text = this.input.trim();
  if (!text) return;

  if (!this.channelId) return;         
  const cid: string = this.channelId;    

  this.chat.sendMessage(cid, this.me?.id || '', text).subscribe((sent: Message | null) => {
    if (sent) this.input = '';
  });
}


  ngOnDestroy(): void {
    this.subRoute?.unsubscribe();
    this.subGroup?.unsubscribe();
    this.subChans?.unsubscribe();
  }
}