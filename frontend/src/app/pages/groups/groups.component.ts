import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';

import { Group } from '../../models/group';
import { User } from '../../models/user';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss']
})
export class GroupsComponent implements OnInit {
  me: User | null = null;

  newGroupName = '';
  usernameToAdd = '';
  usernameToPromote = '';

  myGroups: Group[] = [];
  allGroups: Group[] = [];

  joinRequests: Record<string, string[]> = {};
  promoteRequests: Record<string, string[]> = {};

  constructor(
    private store: StorageService,
    private auth: AuthService,
    private perms: PermissionsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.me = this.auth.currentUser();
    this.refresh();
  }

  private refresh() {
    if (!this.me) return;
    this.allGroups = this.store.getGroups();
    this.myGroups = this.isSuper
      ? this.allGroups
      : (
          this.store.getGroupsForUser
            ? this.store.getGroupsForUser(this.me.id)
            : this.allGroups.filter(g => this.me!.groups.includes(g.id))
        );

    this.joinRequests = {};
    this.promoteRequests = {};

    for (const g of this.myGroups) {
      if (this.canAdmin(g)) {
        this.joinRequests[g.id] = this.store.getJoinRequests(g.id);
        this.promoteRequests[g.id] = this.store.getPromotionRequests(g.id);
      }
    }
  }

  get isSuper() { return this.perms.isSuperAdmin(this.me); }
  canCreateGroup() { return this.perms.isSuperAdmin(this.me) || this.perms.isGroupAdmin(this.me); }
  canAdmin(g: Group) { return this.perms.canAdministerGroup(this.me, g); }
  canModify(g: Group) { return this.perms.canModifyOrDeleteGroup(this.me, g); }
  isCreator(g: Group) { return !!this.me && g.createdBy === this.me.id; }
  isAdmin(g: Group) { return !!this.me && g.adminIds.includes(this.me.id); }

  username(id: string): string { return this.store.getUserById(id)?.username ?? id; }

  createGroup() {
    if (!this.me || !this.newGroupName.trim()) return;
    this.store.addGroup(this.newGroupName.trim(), this.me.id);
    this.newGroupName = '';
    this.refresh();
  }

  rename(g: Group) {
    const v = prompt('New group name:', g.name)?.trim();
    if (!v) return;
    if (!this.canModify(g)) return;
    this.store.renameGroup(g.id, v);
    this.refresh();
  }

  remove(groupId: string) {
    const g = this.store.getGroupById(groupId);
    if (!g || !this.canModify(g)) return;
    if (!confirm('Delete group and its channels/messages?')) return;
    this.store.deleteGroup(groupId);
    this.refresh();
  }

  leave(groupId: string) {
    if (!this.me) return;
    this.store.removeUserFromGroup(groupId, this.me.id);
    this.refresh();
  }

  isInGroup(groupId: string): boolean {
    return this.isSuper || (!!this.me && this.me.groups.includes(groupId));
  }


  addMemberByUsername(groupId: string) {
    const uname = this.usernameToAdd.trim();
    if (!uname) return;
    const u = this.store.getUserByUsername(uname);
    if (!u) { alert('User not found'); return; }
    this.store.addUserToGroup(groupId, u.id);
    this.usernameToAdd = '';
    this.refresh();
  }

  requestToJoin(groupId: string) {
    if (!this.me) return;
    if (this.isSuper) {
      this.openChannels(groupId);
      return;
    }
    this.store.requestJoinGroup(groupId, this.me.id);
    alert('Join request sent.');
    this.refresh();
  }
  approveJoin(groupId: string, userId: string) { this.store.approveJoin(groupId, userId); this.refresh(); }
  rejectJoin(groupId: string, userId: string) { this.store.rejectJoin(groupId, userId); this.refresh(); }

  requestPromotion(groupId: string) {
    const uname = this.usernameToPromote.trim();
    if (!uname) return;
    const u = this.store.getUserByUsername(uname);
    if (!u) { alert('User not found'); return; }
    this.store.requestPromotion(groupId, u.id);
    this.usernameToPromote = '';
    this.refresh();
  }
  approvePromotion(groupId: string, userId: string) { this.store.approvePromotion(groupId, userId); this.refresh(); }
  rejectPromotion(groupId: string, userId: string) { this.store.rejectPromotion(groupId, userId); this.refresh(); }

  openChannels(groupId: string) { this.router.navigate(['/groups', groupId, 'channels']); }
}
