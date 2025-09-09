import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Group } from '../../models/group';
import { User } from '../../models/user';
import { Channel } from '../../models/channel';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
})
export class GroupsComponent implements OnInit {
  me: User | null = null;
  isSuper = false;

  allGroups: Group[] = [];
  myGroups: Group[] = [];

  newGroupName = '';

  usernameToAdd = '';
  usernameToPromote = '';
  usernameToRemove = '';
  usernameToUpgrade = '';

  banChannel: Record<string, string> = {};
  banUsername: Record<string, string> = {};
  banReason: Record<string, string> = {};

  joinRequests: Record<string, string[]> = {};
  promoteRequests: Record<string, string[]> = {};

  constructor(
    private storage: StorageService,
    private auth: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.me = this.auth.currentUser();
    this.isSuper = this.me?.role === 'SUPER_ADMIN';

    this.refreshGroups();
    this.refreshRequests();
  }

  private refreshGroups() {
    this.allGroups = this.storage.getGroups();
    const uid = this.me?.id || '';
    this.myGroups = this.isSuper
      ? this.allGroups
      : this.allGroups.filter(g => this.userInGroup(uid, g.id));
  }


  private refreshRequests() {
    this.joinRequests = {};
    this.promoteRequests = {};
    for (const g of this.storage.getGroups()) {
      this.joinRequests[g.id] = this.storage.getJoinRequests(g.id);
      this.promoteRequests[g.id] = this.storage.getPromotionRequests(g.id);
    }
  }

  isCreator(g: Group): boolean {
    return !!this.me && g.createdBy === this.me.id;
  }

  isAdmin(g: Group): boolean {
    if (!this.me) return false;
    return g.adminIds.includes(this.me.id) || this.isSuper;
  }

  canAdmin(g: Group): boolean {
    return this.isAdmin(g);
  }

  canModify(g: Group): boolean {
    return this.isSuper || this.isCreator(g);
  }

  canCreateGroup(): boolean {
    return this.isSuper || this.me?.role === 'GROUP_ADMIN';
  }

  userInGroup(userId: string, groupId: string): boolean {
    const u = this.storage.getUserById(userId);
    return !!u && u.groups.includes(groupId);
  }

  username(id: string): string {
    return this.storage.getUserById(id)?.username ?? id;
  }

  channelsOf(gid: string): Channel[] {
    return this.storage.getChannelsByGroup(gid);
  }

  createGroup() {
    if (!this.me || !this.canCreateGroup()) return;
    const name = this.newGroupName.trim();
    if (!name) return;

    const { group, firstChannel } = this.storage.addGroup(name, this.me.id);
    this.newGroupName = '';
    this.refreshGroups();
    this.router.navigate(['/chat', group.id, firstChannel.id]);
  }

  rename(g: Group) {
    if (!this.canModify(g)) return;
    const name = prompt('New group name', g.name)?.trim();
    if (!name) return;
    this.storage.renameGroup(g.id, name);
    this.refreshGroups();
  }

  remove(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canModify(g)) return;
    if (!confirm(`Delete group "${g.name}"?`)) return;
    this.storage.deleteGroup(groupId);
    this.refreshGroups();
  }

  leave(groupId: string) {
    if (!this.me) return;
    this.storage.removeUserFromGroup(groupId, this.me.id);
    this.refreshGroups();
  }

  openChannels(groupId: string) {
    this.router.navigate(['/groups', groupId, 'channels']);
  }

  addChannel(groupId: string) {
    if (!this.isAdmin(this.storage.getGroupById(groupId)!)) return;
    const name = prompt('Channel name (e.g., "main")', 'main')?.trim();
    if (!name) return;
    this.storage.addChannel(groupId, name);
    this.refreshGroups();
  }

  addMemberByUsername(groupId: string) {
    const uname = this.usernameToAdd.trim();
    if (!uname) return;
    const u = this.storage.getUserByUsername(uname);
    if (!u) return alert('User not found');
    this.storage.addUserToGroup(groupId, u.id);
    this.usernameToAdd = '';
    this.refreshGroups();
  }

  requestToJoin(groupId: string) {
    if (!this.me) return;
    this.storage.requestJoinGroup(groupId, this.me.id);
    this.refreshRequests();
  }

  approveJoin(groupId: string, userId: string) {
    if (!this.canAdmin(this.storage.getGroupById(groupId)!)) return;
    this.storage.approveJoin(groupId, userId);
    this.refreshRequests();
    this.refreshGroups();
  }

  rejectJoin(groupId: string, userId: string) {
    if (!this.canAdmin(this.storage.getGroupById(groupId)!)) return;
    this.storage.rejectJoin(groupId, userId);
    this.refreshRequests();
  }

  requestPromotion(groupId: string) {
    if (!this.me) return;
    this.storage.requestPromotion(groupId, this.me.id);
    this.refreshRequests();
  }

  approvePromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.storage.approvePromotion(groupId, userId);
    this.refreshRequests();
    this.refreshGroups();
  }

  rejectPromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.storage.rejectPromotion(groupId, userId);
    this.refreshRequests();
  }

  promoteNow(groupId: string) {
    if (!this.isSuper) return;
    const uname = this.usernameToPromote.trim();
    if (!uname) return;
    const u = this.storage.getUserByUsername(uname);
    if (!u) { alert('User not found'); return; }
    this.storage.approvePromotion(groupId, u.id);
    this.usernameToPromote = '';
    this.refreshRequests();
    this.refreshGroups();
  }

  upgradeToSuper() {
    if (!this.isSuper) return;
    const uname = this.usernameToUpgrade.trim();
    if (!uname) return;
    const u = this.storage.getUserByUsername(uname);
    if (!u) return alert('User not found');
    this.storage.setUserRole(u.id, 'SUPER_ADMIN');
    this.usernameToUpgrade = '';
    this.refreshGroups();
  }

  removeAnyUser() {
    if (!this.isSuper) return;
    const uname = this.usernameToRemove.trim();
    if (!uname) return;
    const u = this.storage.getUserByUsername(uname);
    if (!u) return alert('User not found');
    if (!confirm(`Delete user "${u.username}" from the platform?`)) return;
    this.storage.deleteUser(u.id);
    this.usernameToRemove = '';
    this.refreshGroups();
  }

  removeMemberFromGroup(groupId: string) {
    const uname = this.usernameToRemove.trim();
    if (!uname) return;
    const u = this.storage.getUserByUsername(uname);
    if (!u) return alert('User not found');
    this.storage.removeUserFromGroup(groupId, u.id);
    this.usernameToRemove = '';
    this.refreshGroups();
  }

  banInChannel(groupId: string) {
    const channelId = this.banChannel[groupId];
    const uname = (this.banUsername[groupId] || '').trim();
    const reason = (this.banReason[groupId] || '').trim();
    if (!channelId || !uname || !reason) return;

    const u = this.storage.getUserByUsername(uname);
    if (!u) return alert('User not found');

    if (!this.canAdmin(this.storage.getGroupById(groupId)!)) return;

    this.storage.banUser(channelId, u.id);
    this.storage.reportBan(channelId, this.me!.id, u.id, reason);

    this.banUsername[groupId] = '';
    this.banReason[groupId] = '';
    alert(`Banned ${u.username} in channel ${channelId} and reported to super admin.`);
  }

  isInGroup(groupId: string): boolean {
    return !!this.me && this.userInGroup(this.me.id, groupId);
  }

  removeChannelId: Record<string, string | null> = {};

  removeChannel(groupId: string) {
    const chId = this.removeChannelId[groupId];
    if (!chId) { alert('Please select a channel to remove.'); return; }

    const g = this.allGroups.find(x => x.id === groupId) || null;
    if (!g || !this.canAdmin(g)) return;

    const ch = this.storage.getChannelById(chId);
    if (!ch || ch.groupId !== groupId) { alert('Invalid channel selection.'); return; }

    if (!confirm(`Delete channel "${ch.name}" (${ch.id}) from group "${g.name}"?`)) return;

    this.storage.deleteChannel(chId);
    if (!this.storage.getFirstChannelId(groupId)) {
      this.storage.ensureDefaultChannel(groupId);
    }

    this.removeChannelId[groupId] = null;
    this.refreshGroups();
  }
}
