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
  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private storage: StorageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub = this.chat.messages$.subscribe(list => (this.messages = list));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  send(): void {
    const text = this.input.trim();
    if (!text) return;
  
    const u =
      (typeof this.auth.currentUser === 'function' ? this.auth.currentUser() : null) ??
      (typeof (this.storage as any).getCurrentUser === 'function' ? (this.storage as any).getCurrentUser() : null);
  
    const userId = u?.id ?? 'super';  
    const username = u?.username ?? 'super'; 
  
    this.chat.send({ userId, username, text });
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
}
