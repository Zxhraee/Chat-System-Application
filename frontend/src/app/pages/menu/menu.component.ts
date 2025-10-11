import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';
import { PermissionsService } from '../../services/permissions.service';
import { map, filter } from 'rxjs/operators';

import { User } from '../../models/user';
import { Message } from '../../models/message';
import { Group } from '../../models/group';
import { Channel } from '../../models/channel';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})

export class MenuComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  input = '';

  me: User | null = null;
  meResolved = false;
  myGroups: Group[] = [];
  myGroupsResolved = false;
  loadingMyGroups = false;

  activeGroup: Group | null = null;
  channels: Channel[] = [];
  channelId: string | null = null;

  private subMe?: Subscription;
  private subUserGroups?: Subscription;
  private subAllGroups?: Subscription;
  private subChans?: Subscription;
  private subMsgs?: Subscription;
  private rawMessages: Message[] = [];
  private userMap = new Map<string, User>();
  viewMessages: Message[] = [];
  private subUsers?: Subscription;
  activeChannelName = '';
  readonly defaultAvatar = 'assets/default-avatar.png';
  private generalGroupId: string | null = null;
  private lastUserId: string | null = null;

  trackById = (_: number, x: { id: string }) => x.id;
  trackByMessageId = (_: number, m: { id: string }) => m.id;

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router,
    private permissions: PermissionsService,
  ) { }

  isGeneralGroup(g: Group | null): boolean {
  return !!g && (g.name || '').trim().toLowerCase() === 'general';
}

  trackByGroup = (_: number, g: Group) => g?.id;

  ngOnInit(): void {
    this.subMe = this.storage.getCurrentUser().subscribe(me => {
      this.meResolved = true;
      this.me = me;

      this.subUsers = this.storage.getUsers().subscribe(users => {
        this.userMap = new Map(users.map(u => [u.id, u]));
        this.recomputeView();
      });

      if (!me) {
        this.lastUserId = null;
        this.activeGroup = null;
        return;
      }

      if (this.lastUserId !== me.id) {
        this.lastUserId = me.id;
        this.refreshMyGroups();
      }

      if (typeof this.storage.onGroupsUpdated === 'function') {
        this.storage.onGroupsUpdated(() => {
          if (!this.me?.id) return;
          this.refreshMyGroups();
        });
      }

      this.bootstrapGeneralArea();
    });
  }

  private refreshMyGroups(): void {
  if (!this.me?.id) return;

  this.loadingMyGroups = this.myGroups.length === 0 && !this.myGroupsResolved;

  this.subUserGroups?.unsubscribe();
  this.subUserGroups = this.storage.getGroupsForUser(this.me.id).pipe(
    map(userGroups => (userGroups || []).filter(g => !this.isGeneralGroup(g))),
    filter((nonGeneral) => {
      if (!this.myGroupsResolved) return true;

      if (this.myGroups.length > 0 && nonGeneral.length === 0) return false;

      if (this.equalGroupLists(this.myGroups, nonGeneral)) return false;

      return true;
    })
  )
  .subscribe({
    next: (nonGeneral) => {
      this.myGroups = nonGeneral;

      const stillValid = this.activeGroup && this.myGroups.some(g => g.id === this.activeGroup!.id);
      if (!stillValid) this.activeGroup = this.myGroups[0] ?? null;

      this.loadingMyGroups = false;
      this.myGroupsResolved = true;
    },
    error: () => {
      this.loadingMyGroups = false;
      this.myGroupsResolved = true;
    }
  });
}

  private equalGroupLists(a: Group[], b: Group[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || (a[i].name || '') !== (b[i].name || '')) return false;
    }
    return true;
  }

  private bootstrapGeneralArea(): void {
  this.subAllGroups?.unsubscribe();
  this.subAllGroups = this.storage.getGroups().subscribe(allGroups => {
    const general =
      (allGroups || []).find(g => (g.name || '').trim().toLowerCase() === 'general') || null;

    if (!general) {
      this.generalGroupId = null;
      this.channels = [];
      this.channelId = null;
      this.messages = [];
      this.viewMessages = [];
      this.activeChannelName = '';
      return;
    }

    this.generalGroupId = String(general.id);

    this.subChans?.unsubscribe();
    this.subChans = this.storage.getChannelsByGroup(this.generalGroupId).subscribe(chs => {
      const hadChannels = this.channels?.length > 0;

      // normalize
      this.channels = (chs || []).map((c: any) => ({
        ...c,
        id: String(c.id ?? c._id),
        groupId: String(c.groupId?.id ?? c.groupId?._id ?? c.groupId),
      }));

      if (!this.channels.length) {
        this.storage.ensureDefaultChannel(this.generalGroupId!).subscribe(() => {
          this.storage.getChannelsByGroup(this.generalGroupId!).subscribe(chs2 => {
            this.channels = (chs2 || []).map((c: any) => ({
              ...c,
              id: String(c.id ?? c._id),
              groupId: String(c.groupId?.id ?? c.groupId?._id ?? c.groupId),
            }));
            if (!this.channelId) this.setChannel(this.channels[0]?.id ?? null);
          });
        });
      } else {
        if (!hadChannels || !this.channelId) {
          this.setChannel(this.channels[0]?.id ?? null);
        }
      }
    });
  });
}

  changeGeneralChannel(id: any): void {
    this.setChannel(id == null ? null : String(id));
  }


  setChannel(id: string | null) {
  if (this.channelId === id) return;

  if (this.channelId) this.chat.leaveChannel(this.channelId);
  this.subMsgs?.unsubscribe();

  this.channelId = id;

  this.rawMessages = [];
  this.viewMessages = [];
  this.activeChannelName = '';

  if (!id) return;

  const ch = this.channels.find(c => String(c.id) === id);
  this.activeChannelName = ch?.name || '';

  const me = this.user();
  const minimalUser = me ? { id: me.id, username: me.username } : null;
  this.chat.joinChannel(id, minimalUser);

  this.subMsgs = this.chat.messages$(id).subscribe(list => {
    this.rawMessages = list || [];
    this.recomputeView();
  });
}

 goChannel(channelId: string | null): void {
  if (!channelId || !this.generalGroupId) return;
  this.router.navigate(['/chat', this.generalGroupId, channelId]);
}


  send(): void {
    const text = this.input.trim();
    if (!text || !this.channelId) return;

    this.chat
      .sendMessage(this.channelId, this.me?.id || '', text, this.me?.username)
      .subscribe({
        next: () => (this.input = ''),
        error: (e) => console.error('send failed', e),
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

  user(): User | null { return this.auth.currentUser(); }

  canAdminister(group: Group | null): boolean {
    return !!group && this.permissions.canAdministerGroup(this.user(), group);
  }

  openGroupDefaultChannel(g: Group) {
    this.storage.getChannelsByGroup(g.id).subscribe(chs => {
      const first = chs[0]?.id;
      if (first) this.router.navigate(['/chat', g.id, first]);
      else this.router.navigate(['/groups', g.id, 'channels']);
    });
  }

  ngOnDestroy(): void {
    if (this.channelId) this.chat.leaveChannel(this.channelId);
    this.subMe?.unsubscribe();
    this.subUserGroups?.unsubscribe();
    this.subAllGroups?.unsubscribe();
    this.subChans?.unsubscribe();
    this.subMsgs?.unsubscribe();
    this.subUsers?.unsubscribe();
  }
}
