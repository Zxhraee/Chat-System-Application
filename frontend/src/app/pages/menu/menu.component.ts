import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';
import { PermissionsService } from '../../services/permissions.service';

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

  private lastUserId: string | null = null;

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router,
    private permissions: PermissionsService,
  ) { }

  isGeneralGroup(g: Group | null): boolean {
    return !!g && (g.id === 'GLOBAL' || (g.name || '').trim().toLowerCase() === 'general');
  }

  trackByGroup = (_: number, g: Group) => g?.id;

  ngOnInit(): void {
    this.subMe = this.storage.getCurrentUser().subscribe(me => {
      this.meResolved = true;
      this.me = me;

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
    this.subUserGroups = this.storage.getGroupsForUser(this.me.id).subscribe({
      next: (userGroups) => {
        const nonGeneral = (userGroups || []).filter(g => !this.isGeneralGroup(g));
        if (!this.equalGroupLists(this.myGroups, nonGeneral)) {
          this.myGroups = nonGeneral;
          if (!this.activeGroup || !this.myGroups.find(g => g.id === this.activeGroup!.id)) {
            this.activeGroup = this.myGroups[0] ?? null;
          }
        }
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
        allGroups.find(g => g.id === 'GLOBAL') ||
        allGroups.find(g => (g.name || '').toLowerCase() === 'general') ||
        null;

      if (!general) {
        this.channels = [];
        this.channelId = null;
        this.messages = [];
        return;
      }

      this.subChans?.unsubscribe();
      this.subChans = this.storage.getChannelsByGroup(general.id).subscribe(chs => {
        const hadChannels = this.channels?.length > 0;
        this.channels = chs || [];

        if (!this.channels.length) {
          this.storage.ensureDefaultChannel(general.id).subscribe(() => {
            this.storage.getChannelsByGroup(general.id).subscribe(chs2 => {
              this.channels = chs2 || [];
              if (!this.channelId) this.setChannel(this.channels[0]?.id || null);
            });
          });
        } else {
          if (!hadChannels || !this.channelId) {
            this.setChannel(this.channels[0]?.id || null);
          }
        }
      });
    });
  }

  private setChannel(id: string | null) {
    if (this.channelId === id) return;
    this.channelId = id;
    this.subMsgs?.unsubscribe();
    if (!id) { this.messages = []; return; }
    this.subMsgs = this.chat.messages$(id).subscribe(list => (this.messages = list));
  }

  changeGeneralChannel(id: string | null): void {
    if (!id) return;
    this.setChannel(id);
  }

  goChannel(channelId: string | null): void {
    if (!channelId) return;
    this.router.navigate(['/chat', 'GLOBAL', channelId]);
  }

  send(): void {
    const text = this.input.trim();
    if (!text || !this.channelId) return;
    this.chat.sendMessage(this.channelId, this.me?.id || '', text).subscribe(sent => {
      if (sent) this.input = '';
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
    this.subMe?.unsubscribe();
    this.subUserGroups?.unsubscribe();
    this.subAllGroups?.unsubscribe();
    this.subChans?.unsubscribe();
    this.subMsgs?.unsubscribe();
  }
}
