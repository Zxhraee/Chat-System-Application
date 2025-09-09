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
  activeGroup: Group | null = null;  

  me: User | null = null;
  myGroups: Group[] = [];

  channels: Channel[] = [];
  channelId: string | null = null;

  private sub?: Subscription;
  private generalChannelId: string | null = null;   
  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router,
    private permissions: PermissionsService,
  ) {}

  ngOnInit(): void {
    const currentUser = this.user();
    if (!currentUser) return;
  
    const isSuper = this.permissions.isSuperAdmin(currentUser);
  
    const allGroups = (this.storage.getAllGroups?.() ?? this.storage.getGroups());
  
    const isInGroup = (g: Group) => {
      const u = currentUser;
      if (!u) return false;
      if (g.createdBy === u.id) return true;
      if (Array.isArray(g.adminIds) && g.adminIds.includes(u.id)) return true;
      return Array.isArray(u.groups) && u.groups.includes(g.id);
    };
  
    const notGeneral = (g: Group) => !this.isGeneralGroup(g);
  
    this.myGroups = isSuper
      ? allGroups.filter(notGeneral)
      : allGroups.filter(g => isInGroup(g) && notGeneral(g));
  
    this.activeGroup = this.myGroups[0] ?? null;
    this.generalChannelId = this.resolveGeneralChannelId();
    this.refreshGeneralChannels();
    
    if (this.channelId) {
      this.sub = this.chat.messages$(this.channelId)
        .subscribe(list => (this.messages = list));
    }
    }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  selectGroup(g: Group): void {
    this.activeGroup = g;
    this.generalChannelId = this.resolveGeneralChannelId();
    this.refreshGeneralChannels();
  }

  private getGeneralGroup(): Group | null {
    const groups = this.storage.getGroups();
    return (
      groups.find(g => g.id === 'GLOBAL') ??
      groups.find(g => (g.name || '').toLowerCase() === 'general') ??
      null
    );
  }
  
  private refreshGeneralChannels(): void {
    const gen = this.getGeneralGroup();
    if (!gen) { this.channels = []; this.channelId = null; return; }
  
    this.channels = this.storage.getChannelsByGroup(gen.id);
    if (!this.channels.length) {
      const created = this.storage.ensureDefaultChannel(gen.id);
      const _newId = (created as any)?.id ?? created;
      this.channels = this.storage.getChannelsByGroup(gen.id);
    }
  
    this.channelId = this.generalChannelId ?? this.channels[0]?.id ?? null;
  }

  changeGeneralChannel(id: string | null): void {
    if (!id) return;
    this.channelId = id;
    this.sub?.unsubscribe();
    this.sub = this.chat.messages$(id).subscribe(list => (this.messages = list));
  }
  
  goChannel(channelId: string | null): void {
    if (!channelId) return;
    const gen = this.getGeneralGroup();
    if (!gen) return;
    this.router.navigate(['/chat', gen.id, channelId]);
  }

  trackByChan = (_: number, c: Channel) => c.id;
  trackByGroup = (_: number, g: Group) => g.id;

  send(): void {
    const text = this.input.trim();
    if (!text || !this.channelId) return;
    const sent = this.chat.send(this.channelId, text);
    if (sent) this.input = '';
  }


  private resolveGeneralChannelId(): string | null {
    const groups = this.storage.getGroups();
    const generalGroup =
      groups.find(g => g.id === 'GLOBAL') ??
      groups.find(g => (g.name || '').toLowerCase() === 'general');

    if (generalGroup?.channelId?.length) return generalGroup.channelId[0];

    const cGlobal = this.storage.getChannelById('C_GLOBAL');
    return cGlobal?.id ?? null;
  }

  user(): User | null { return this.auth.currentUser(); }

  canAdminister(group: Group | null): boolean { 
    return !!group && this.permissions.canAdministerGroup(this.user(), group);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openGroupDefaultChannel(g: Group) {
    const first = g?.channelId?.[0];
    if (first) this.router.navigate(['/chat', g.id, first]);
    else this.router.navigate(['/groups', g.id, 'channels']);
  }

  isGeneralGroup(g: Group): boolean {
    return g?.id === 'GLOBAL' || (g?.name || '').toLowerCase() === 'general';
  }
}
