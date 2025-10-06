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
import { ChatMessage } from '../../models/message';
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
  messages: ChatMessage[] = [];
  input = '';

  me: User | null = null;
  myGroups: Group[] = [];

  activeGroup: Group | null = null;
  channels: Channel[] = [];
  channelId: string | null = null;

  private subMe?: Subscription;
  private subGroups?: Subscription;
  private subChans?: Subscription;
  private subMsgs?: Subscription;

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router,
    private permissions: PermissionsService,
  ) {}

  ngOnInit(): void {
    this.subMe = this.storage.getCurrentUser().subscribe(me => {
      this.me = me;
      if (!me) return;

      this.subGroups?.unsubscribe();
      this.subGroups = this.storage.getGroups().subscribe(groups => {
        const isSuper = this.permissions.isSuperAdmin(me);

        const notGeneral = (g: Group) =>
          !(g?.id === 'GLOBAL' || (g?.name || '').toLowerCase() === 'general');

        const isInGroup = (g: Group) => {
          if (g.createdBy === me.id) return true;
          if (Array.isArray(g.adminIds) && g.adminIds.includes(me.id)) return true;
          return Array.isArray(me.groups) && me.groups.includes(g.id);
        };

        this.myGroups = isSuper ? groups.filter(notGeneral) : groups.filter(g => notGeneral(g) && isInGroup(g));

        const general =
          groups.find(g => g.id === 'GLOBAL') ||
          groups.find(g => (g.name || '').toLowerCase() === 'general') ||
          null;

        if (!general) {
          this.activeGroup = this.myGroups[0] ?? null;
          this.channels = [];
          this.channelId = null;
          this.messages = [];
          return;
        }

        this.activeGroup = this.myGroups[0] ?? null;

        this.subChans?.unsubscribe();
        this.subChans = this.storage.getChannelsByGroup(general.id).subscribe(chs => {
          this.channels = chs || [];

          if (!this.channels.length) {
            this.storage.ensureDefaultChannel(general.id).subscribe(created => {
              this.storage.getChannelsByGroup(general.id).subscribe(chs2 => {
                this.channels = chs2 || [];
                const first = this.channels[0]?.id || null;
                this.setChannel(first);
              });
            });
          } else {
            const first = this.channels[0]?.id || null;
            this.setChannel(first);
          }
        });
      });
    });
  }

  private setChannel(id: string | null) {
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
    if (!text) return;
    if (!this.channelId) return;

    const cid: string = this.channelId;
    this.chat.send(cid, text).subscribe((sent: ChatMessage | null) => {
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

  isGeneralGroup(g: Group): boolean {
    return g?.id === 'GLOBAL' || (g?.name || '').toLowerCase() === 'general';
  }

  ngOnDestroy(): void {
    this.subMe?.unsubscribe();
    this.subGroups?.unsubscribe();
    this.subChans?.unsubscribe();
    this.subMsgs?.unsubscribe();
  }
}