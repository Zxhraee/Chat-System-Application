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
    if (currentUser) {
      const myGroups = this.storage.getGroups().filter(g => currentUser.groups.includes(g.id));
      this.activeGroup = myGroups[0] ?? null;

      this.myGroups = this.permissions.isSuperAdmin(currentUser)
        ? this.storage.getGroups()
        : myGroups;
    }

    this.generalChannelId = this.resolveGeneralChannelId();

    if (this.generalChannelId) {
      this.sub = this.chat.messages$(this.generalChannelId)
        .subscribe((list: ChatMessage[]) => (this.messages = list));
    }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  send(): void {
    const text = this.input.trim();
    if (!text || !this.generalChannelId) return;
    const sent = this.chat.send(this.generalChannelId, text);
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
