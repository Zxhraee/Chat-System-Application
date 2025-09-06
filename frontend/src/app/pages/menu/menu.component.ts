import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { StorageService } from '../../services/storage.service';

import { User } from '../../models/user';
import { ChatMessage } from '../../models/message';

import { Group } from '../../models/group';
import { PermissionsService } from '../../services/permissions.service';



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

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router,
    private permissions: PermissionsService,
  ) {}

  ngOnInit(): void {
    this.sub = this.chat.messages$.subscribe(list => (this.messages = list));
  
    const currentUser = this.user();
    if (currentUser) {
      const myGroups = this.storage.getGroups().filter(g => currentUser.groups.includes(g.id));
      this.activeGroup = myGroups[0] ?? null;
  
      const firstChannelId = this.activeGroup?.channelId[0];
      if (firstChannelId) {
        this.chat.setChannel(firstChannelId);
        this.chat.load();
      }
  
      this.myGroups = this.permissions.isSuperAdmin(currentUser)
        ? this.storage.getGroups()
        : myGroups;
    }
  }
  

  canAdminister(group: Group | null): boolean { 
    return !!group && this.permissions.canAdministerGroup(this.user(), group);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  send(): void {
    const text = this.input.trim();
    if (!text) return;
  
    this.chat.send({ text });
  
    this.input = '';
  }

  
  user(): User | null {
    return this.auth.currentUser();
  }

  isSuperAdmin(): boolean {
    const u = this.user();
    return !!u && Array.isArray((u as any).role) && (u as any).role.includes('SUPER_ADMIN');
  }

  isGroupAdminorSuperAdmin(): boolean {
    const u = this.user();
    return (
      !!u &&
      Array.isArray((u as any).role) &&
      (u as any).role.some((r: string) => r === 'GROUP_ADMIN' || r === 'SUPER_ADMIN')
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openGroupDefaultChannel(g: Group) {
    const first = g?.channelId?.[0];
    if (first) {
      this.router.navigate(['/chat', g.id, first]);
    } else {
      this.router.navigate(['/groups', g.id, 'channels']);
    }
  }
}
