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
  private rawMessages: Message[] = [];
  private userMap = new Map<string, User>();
  viewMessages: Message[] = [];

  activeGroup: Group | null = null;
  activeChannelName = '';
  channels: Channel[] = [];

  groupId = '';
  channelId = '';

  private subRoute?: Subscription;
  private subGroup?: Subscription;
  private subChans?: Subscription;
  private subMe?: Subscription;
  private subUsers?: Subscription;
  private subMsgs?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chat: ChatService,
    private store: StorageService
  ) { }

  ngOnInit(): void {
    this.subMe = this.store.getCurrentUser().subscribe(u => (this.me = u));

    this.subUsers = this.store.getUsers().subscribe(users => {
      this.userMap = new Map(users.map(u => [u.id, u]));
      this.recomputeView();
    });


    this.subRoute = this.route.paramMap.subscribe(() => {
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
            this.store.ensureDefaultChannel(gid).subscribe(() => {
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

  private recomputeView() {
    this.viewMessages = this.rawMessages.map(m => {
      const u = this.userMap.get(m.userId);
      return {
        ...m,
        avatarUrl: m.avatarUrl || u?.avatarUrl || ''
      };
    });
  }

  private setActiveChannel(id: string) {
    if (!id) return;

    if (this.channelId && this.channelId !== id) {
      this.chat.leaveChannel(this.channelId);
    }

    this.channelId = id;
    const ch = this.channels.find(c => c.id === id);
    this.activeChannelName = ch?.name || '';

    const minimalUser = this.me ? { id: this.me.id, username: this.me.username } : null;
    this.chat.joinChannel(id, minimalUser);
    this.messages$ = this.chat.messages$(id);

    this.subMsgs?.unsubscribe();
    this.subMsgs = this.messages$.subscribe(msgs => {
      this.rawMessages = msgs || [];
      this.recomputeView();
    });
  }

  goChannel(id: string) {
    if (id && id !== this.channelId) this.router.navigate(['/chat', this.groupId, id]);
  }

  send(): void {
    const text = this.input.trim();
    if (!text || !this.channelId) return;

    this.chat
      .sendMessage(this.channelId, this.me?.id || '', text, this.me?.username)
      .subscribe({
        next: () => { this.input = ''; },
        error: (e) => console.error('send failed', e),
      });
  }

  ngOnDestroy(): void {
    if (this.channelId) this.chat.leaveChannel(this.channelId);
    this.subRoute?.unsubscribe();
    this.subGroup?.unsubscribe();
    this.subChans?.unsubscribe();
    this.subMe?.unsubscribe();
    this.subUsers?.unsubscribe();
    this.subMsgs?.unsubscribe();
  }
}
