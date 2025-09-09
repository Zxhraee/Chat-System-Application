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

  usernameToUpgrade = '';
  usernameToRemove = '';

  upgradeUserIdGlobal: string | null = null;


  addMemberUserId: Record<string, string | null> = {};
  promoteUserId:   Record<string, string | null> = {};
  removeUserId:    Record<string, string | null> = {};
  banUserId:       Record<string, string | null> = {};

  banChannel: Record<string, string> = {};
  banReason:  Record<string, string> = {};

  joinRequests:    Record<string, string[]> = {};
  promoteRequests: Record<string, string[]> = {};
  
  removeUserIdGlobal: Record<string, string | null> = {};

  constructor(
    private storage: StorageService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.me = this.auth.currentUser();
    this.isSuper = this.me?.role === 'SUPER_ADMIN';
    this.refreshGroups();
    this.refreshRequests();
  }

  private refreshGroups() {
    const uid = this.me?.id || '';
    this.allGroups = this.storage.getAllGroups();

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
    return (g.adminIds ?? []).includes(this.me.id) || this.isSuper;
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
    const g = this.storage.getGroupById(groupId);
    if (!u || !g) return false;

    if (u.groups?.includes(groupId)) return true;
    if (g.createdBy === userId) return true;
    if (Array.isArray(g.adminIds) && g.adminIds.includes(userId)) return true;

    return false;
  }

  isInGroup(groupId: string): boolean {
    return !!this.me && this.userInGroup(this.me.id, groupId);
  }

// keep this helper (already suggested before)
getUpgradableUsers(): User[] {
  return this.storage.getUsers().filter(u => u.role !== 'SUPER_ADMIN');
}

// new global action (replace old per-group upgrade method)
upgradeToSuperGlobal() {
  if (!this.isSuper) return;
  const uid = this.upgradeUserIdGlobal;
  if (!uid) return;

  const u = this.storage.getUserById(uid);
  if (!u) { alert('User not found'); return; }

  this.storage.setUserRole(uid, 'SUPER_ADMIN');
  this.upgradeUserIdGlobal = null;
  this.refreshGroups();
}
  
getDeletableUsersInGroup(gid: string): User[] {
  const meId = this.me?.id;
  const g = this.storage.getGroupById(gid);
  if (!g) return [];

  return this.usersIn(gid)
    .filter(u => u.id !== meId)               // don't let me delete myself
    .filter(u => u.id !== g.createdBy);       // don't allow deleting group creator
    // If you also want to forbid deleting SUPERs globally, add:
    // .filter(u => u.role !== 'SUPER_ADMIN');
}
  
  isGeneralGroup(g: Group | null): boolean {
    if (!g) return false;
    return g.id === 'G1' || (g.name || '').toLowerCase() === 'general';
  }

  hasPendingJoin(groupId: string): boolean {
    if (!this.me) return false;
    const list = this.joinRequests[groupId] || [];
    return list.includes(this.me.id);
  }

  get discoverGroups(): Group[] {
    if (this.isSuper) return [];
    return this.allGroups.filter(
      g =>
        !this.isGeneralGroup(g) &&
        !this.userInGroup(this.me?.id || '', g.id) &&
        !this.hasPendingJoin(g.id)
    );
  }

  username(id: string): string {
    return this.storage.getUserById(id)?.username ?? id;
  }

  displayName(u: User): string {
    return `${u.username} (${u.id})`;
  }

  private allUsers(): User[] {
    return this.storage.getUsers();
  }

  private usersIn(gid: string): User[] {
    return this.allUsers().filter(u => Array.isArray(u.groups) && u.groups.includes(gid));
  }

  private usersNotIn(gid: string): User[] {
    return this.allUsers().filter(u => !Array.isArray(u.groups) || !u.groups.includes(gid));
  }

  getAddableUsers(gid: string): User[] {
    return this.usersNotIn(gid);
  }

  getPromotableUsers(gid: string): User[] {
    const g = this.storage.getGroupById(gid);
    if (!g) return [];
    return this.usersIn(gid).filter(u => !(g.adminIds ?? []).includes(u.id));
  }

  getRemovableUsers(gid: string): User[] {
    const g = this.storage.getGroupById(gid);
    if (!g) return [];
    return this.usersIn(gid).filter(u => u.id !== g.createdBy);
  }

  getBannableUsers(gid: string): User[] {
    return this.usersIn(gid);
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
    if (this.isGeneralGroup(g)) return;
    if (!confirm(`Delete group "${g.name}"?`)) return;
    this.storage.deleteGroup(groupId);
    this.refreshGroups();
  }

  leave(groupId: string) {
    const g = this.storage.getGroupById(groupId);
    if (this.isGeneralGroup(g)) {
      alert('You cannot leave the General group.');
      return;
    }
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
    const uid = this.addMemberUserId[groupId];
    if (!uid) return;
    this.storage.addUserToGroup(groupId, uid);
    this.addMemberUserId[groupId] = null;
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
    const uid = this.promoteUserId[groupId];
    if (!uid) return;
    this.storage.requestPromotion(groupId, uid);
    this.promoteUserId[groupId] = null;
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
    const uid = this.promoteUserId[groupId];
    if (!uid) { alert('Select a user to promote'); return; }
    this.storage.approvePromotion(groupId, uid);
    this.promoteUserId[groupId] = null;
    this.refreshRequests();
    this.refreshGroups();
  }

  
  removeAnyUser(groupId: string) {
    if (!this.isSuper) return;
    const uid = this.removeUserIdGlobal[groupId];
    if (!uid) return;
  
    const me = this.me;
    if (uid === me?.id) { alert('You cannot delete yourself.'); return; }
  
    const u = this.storage.getUserById(uid);
    if (!u) { alert('User not found'); return; }
  
    if (!confirm(`Delete user "${u.username}" from the platform?`)) return;
  
    this.storage.deleteUser(uid);
  
    // (optional) also scrub from groups/admin lists if your StorageService doesn’t already
    // const groups = this.storage.getAllGroups().map(g => ({
    //   ...g,
    //   adminIds: (g.adminIds || []).filter(id => id !== uid),
    //   createdBy: g.createdBy === uid ? g.createdBy : g.createdBy,
    // }));
    // this.storage.setGroups(groups);
  
    this.removeUserIdGlobal[groupId] = null;
    this.refreshGroups();
  }
  
  
  removeMemberFromGroup(groupId: string) {
    const uid = this.removeUserId[groupId];
    if (!uid) { alert('Select a user to remove'); return; }
    const g = this.storage.getGroupById(groupId);
    if (g && this.isGeneralGroup(g)) return; 
    this.storage.removeUserFromGroup(groupId, uid);
    this.removeUserId[groupId] = null;
    this.refreshGroups();
  }

  banInChannel(groupId: string) {
    const channelId = this.banChannel[groupId];
    const uid = this.banUserId[groupId];
    const reason = (this.banReason[groupId] || '').trim();
    if (!channelId || !uid || !reason) return;

    if (!this.canAdmin(this.storage.getGroupById(groupId)!)) return;

    this.storage.banUser(channelId, uid);
    this.storage.reportBan(channelId, this.me!.id, uid, reason);

    this.banUserId[groupId] = null;
    this.banReason[groupId] = '';
    alert(`Banned user in channel ${channelId} and reported to super admin.`);
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
