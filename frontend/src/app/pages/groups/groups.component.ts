import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Group } from '../../models/group';
import { User } from '../../models/user';
import { Channel } from '../../models/channel';
import { Subscription } from 'rxjs';

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
  groups$ = this.storage.groups$; 

  allGroups: Group[] = [];
  myGroups: Group[] = [];
  allUsers: User[] = [];

  channelsCache: Record<string, Channel[]> = {};

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

  private subMe?: Subscription;
  private subUsers?: Subscription;
  private subGroups?: Subscription;

  constructor(
    private storage: StorageService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subMe = this.storage.getCurrentUser().subscribe(me => {
      this.me = me;
      this.isSuper = this.me?.role === 'SUPER_ADMIN';

      this.subUsers?.unsubscribe();
      this.subUsers = this.storage.getUsers().subscribe(users => {
        this.allUsers = users || [];

        this.subGroups?.unsubscribe();
        this.subGroups = this.storage.getGroups().subscribe(groups => {
  if (!groups) return;
  this.allGroups = groups;
  this.computeMyGroups();
  this.refreshRequests();
  this.preloadGeneralChannels();
});

      });
    });
  }


  private computeMyGroups(): void {
    const uid = this.me?.id || '';
    const notGeneral = (g: Group) => !this.isGeneralGroup(g);

    if (this.isSuper) {
      this.myGroups = this.allGroups.filter(notGeneral);
      return;
    }

    this.myGroups = this.allGroups.filter(g => {
      if (!notGeneral(g)) return false;
      const u = this.me;
      if (!u) return false;
      if (g.createdBy === u.id) return true;
      if (Array.isArray(g.adminIds) && g.adminIds.includes(u.id)) return true;
      return Array.isArray(u.groups) && u.groups.includes(g.id);
    });
  }

  private refreshRequests(): void {
    this.joinRequests = {};
    this.promoteRequests = {};

    for (const g of this.allGroups) {
      const jr$ = this.storage.getJoinRequests(g.id);
      if ((jr$ as any)?.subscribe) {
        (jr$ as any).subscribe((list: string[]) => (this.joinRequests[g.id] = list || []));
      } else {
        this.joinRequests[g.id] = (jr$ as unknown as string[]) || [];
      }

      const pr$ = this.storage.getPromotionRequests(g.id);
      if ((pr$ as any)?.subscribe) {
        (pr$ as any).subscribe((list: string[]) => (this.promoteRequests[g.id] = list || []));
      } else {
        this.promoteRequests[g.id] = (pr$ as unknown as string[]) || [];
      }
    }
  }

  private preloadGeneralChannels(): void {
    const gen = this.generalGroup();
    if (!gen) return;
    this.storage.getChannelsByGroup(gen.id).subscribe(chs => {
      this.channelsCache[gen.id] = chs || [];
    });
  }

  private generalGroup(): Group | null {
    return (
      this.allGroups.find(g => g.id === 'GLOBAL') ||
      this.allGroups.find(g => (g.name || '').toLowerCase() === 'general') ||
      null
    );
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

  isGeneralGroup(g: Group | null): boolean {
    if (!g) return false;
    return g.id === 'GLOBAL' || (g.name || '').toLowerCase() === 'general';
  }

  userInGroup(userId: string, groupId: string): boolean {
    const u = this.allUsers.find(x => x.id === userId);
    const g = this.allGroups.find(x => x.id === groupId);
    if (!u || !g) return false;

    if (u.groups?.includes(groupId)) return true;
    if (g.createdBy === userId) return true;
    if (Array.isArray(g.adminIds) && g.adminIds.includes(userId)) return true;
    return false;
  }

  isInGroup(groupId: string): boolean {
    return !!this.me && this.userInGroup(this.me.id, groupId);
  }

  getUpgradableUsers(): User[] {
    return this.allUsers.filter(u => u.role !== 'SUPER_ADMIN');
  }

  upgradeToSuperGlobal() {
    if (!this.isSuper) return;
    const uid = this.upgradeUserIdGlobal;
    if (!uid) return;

    const u = this.allUsers.find(x => x.id === uid);
    if (!u) { alert('User not found'); return; }

    const op$ = this.storage.setUserRole(uid, 'SUPER_ADMIN');
    if ((op$ as any)?.subscribe) {
      (op$ as any).subscribe(() => {
        this.upgradeUserIdGlobal = null;
        this.reloadUsersAndGroups();
      });
    } else {
      this.upgradeUserIdGlobal = null;
      this.reloadUsersAndGroups();
    }
  }

  getDeletableUsersInGroup(gid: string): User[] {
    const meId = this.me?.id;
    const g = this.allGroups.find(x => x.id === gid);
    if (!g) return [];
    return this.usersIn(gid)
      .filter(u => u.id !== meId)
      .filter(u => u.id !== g.createdBy);
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
    const u = this.allUsers.find(x => x.id === id);
    return u?.username ?? id;
  }

  displayName(u: User): string { return `${u.username} (${u.id})`; }

  private usersIn(gid: string): User[] {
    return this.allUsers.filter(u => Array.isArray(u.groups) && u.groups.includes(gid));
  }

  private usersNotIn(gid: string): User[] {
    return this.allUsers.filter(u => !Array.isArray(u.groups) || !u.groups.includes(gid));
  }

  getAddableUsers(gid: string): User[] { return this.usersNotIn(gid); }

  getPromotableUsers(gid: string): User[] {
    const g = this.allGroups.find(x => x.id === gid);
    if (!g) return [];
    return this.usersIn(gid).filter(u => !(g.adminIds ?? []).includes(u.id));
  }

  getRemovableUsers(gid: string): User[] {
    const g = this.allGroups.find(x => x.id === gid);
    if (!g) return [];
    return this.usersIn(gid).filter(u => u.id !== g.createdBy);
  }

  getBannableUsers(gid: string): User[] { return this.usersIn(gid); }

  channelsOf(gid: string): Channel[] {
    return this.channelsCache[gid] || [];
  }

  hasPendingJoin(groupId: string): boolean {
    const meId = this.me?.id;
    if (!meId) return false;
    const list = this.joinRequests[groupId] || [];
    return list.includes(meId);
  }


  createGroup() {
    if (!this.me || !this.canCreateGroup()) return;
    const name = this.newGroupName.trim();
    if (!name) return;

    this.storage.addGroup(name, this.me.id).subscribe(result => {
      this.newGroupName = '';
      this.reloadUsersAndGroups(() => {
        this.router.navigate(['/chat', result.group.id, result.firstChannel.id]);
      });
    });
  }

  rename(g: Group) {
    if (!this.canModify(g)) return;
    const name = prompt('New group name', g.name)?.trim();
    if (!name) return;
    this.storage.renameGroup(g.id, name).subscribe(() => {
      this.reloadUsersAndGroups();
    });
  }

  remove(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canModify(g)) return;
    if (this.isGeneralGroup(g)) return;
    if (!confirm(`Delete group "${g.name}"?`)) return;

    this.storage.deleteGroup(groupId).subscribe(() => {
      this.reloadUsersAndGroups();
    });
  }

  leave(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId) || null;
    if (this.isGeneralGroup(g)) { alert('You cannot leave the General group.'); return; }
    if (!this.me) return;

    this.storage.removeUserFromGroup(groupId, this.me.id).subscribe(() => {
      this.reloadUsersAndGroups();
    });
  }

  openChannels(groupId: string) {
    this.router.navigate(['/groups', groupId, 'channels']);
  }

  addChannel(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.isAdmin(g)) return;
    const name = prompt('Channel name (e.g., "main")', 'main')?.trim();
    if (!name) return;

    this.storage.addChannel(groupId, name).subscribe(() => {
      this.storage.getChannelsByGroup(groupId).subscribe(chs => {
        this.channelsCache[groupId] = chs || [];
      });
    });
  }

  addMemberByUsername(groupId: string) {
    const uid = this.addMemberUserId[groupId];
    if (!uid) return;

    this.storage.addUserToGroup(groupId, uid).subscribe(() => {
      this.addMemberUserId[groupId] = null;
      this.reloadUsersAndGroups();
    });
  }

  requestToJoin(groupId: string) {
    if (!this.me) return;
    this.storage.requestJoinGroup(groupId, this.me.id).subscribe(() => {
      this.refreshRequests();
    });
  }

  approveJoin(groupId: string, userId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canAdmin(g)) return;

    this.storage.approveJoin(groupId, userId).subscribe(() => {
      this.refreshRequests();
      this.reloadUsersAndGroups();
    });
  }

  rejectJoin(groupId: string, userId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canAdmin(g)) return;

    this.storage.rejectJoin(groupId, userId).subscribe(() => {
      this.refreshRequests();
    });
  }

  requestPromotion(groupId: string) {
    const uid = this.promoteUserId[groupId];
    if (!uid) return;

    this.storage.requestPromotion(groupId, uid).subscribe(() => {
      this.promoteUserId[groupId] = null;
      this.refreshRequests();
    });
  }

  approvePromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.storage.approvePromotion(groupId, userId).subscribe(() => {
      this.refreshRequests();
      this.reloadUsersAndGroups();
    });
  }

  rejectPromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.storage.rejectPromotion(groupId, userId).subscribe(() => {
      this.refreshRequests();
    });
  }

  promoteNow(groupId: string) {
    if (!this.isSuper) return;
    const uid = this.promoteUserId[groupId];
    if (!uid) { alert('Select a user to promote'); return; }
    this.storage.approvePromotion(groupId, uid).subscribe(() => {
      this.promoteUserId[groupId] = null;
      this.refreshRequests();
      this.reloadUsersAndGroups();
    });
  }

  removeAnyUser(groupId: string) {
    if (!this.isSuper) return;
    const uid = this.removeUserIdGlobal[groupId];
    if (!uid) return;

    const me = this.me;
    if (uid === me?.id) { alert('You cannot delete yourself.'); return; }

    const u = this.allUsers.find(x => x.id === uid);
    if (!u) { alert('User not found'); return; }

    if (!confirm(`Delete user "${u.username}" from the platform?`)) return;

    this.storage.deleteUser(uid).subscribe(() => {
      this.removeUserIdGlobal[groupId] = null;
      this.reloadUsersAndGroups();
    });
  }

  removeMemberFromGroup(groupId: string) {
    const uid = this.removeUserId[groupId];
    if (!uid) { alert('Select a user to remove'); return; }

    const g = this.allGroups.find(x => x.id === groupId) || null;
    if (g && this.isGeneralGroup(g)) return;

    this.storage.removeUserFromGroup(groupId, uid).subscribe(() => {
      this.removeUserId[groupId] = null;
      this.reloadUsersAndGroups();
    });
  }

  banInChannel(groupId: string) {
    const channelId = this.banChannel[groupId];
    const uid = this.banUserId[groupId];
    const reason = (this.banReason[groupId] || '').trim();
    if (!channelId || !uid || !reason) return;

    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canAdmin(g)) return;

    this.storage.banUser(channelId, uid).subscribe(() => {
      this.storage.reportBan(channelId, this.me!.id, uid, reason).subscribe(() => {
        this.banUserId[groupId] = null;
        this.banReason[groupId] = '';
        alert(`Banned user in channel ${channelId} and reported to super admin.`);
      });
    });
  }

  removeChannelId: Record<string, string | null> = {};

  removeChannel(groupId: string) {
    const chId = this.removeChannelId[groupId];
    if (!chId) { alert('Please select a channel to remove.'); return; }

    const g = this.allGroups.find(x => x.id === groupId) || null;
    if (!g || !this.canAdmin(g)) return;

    const chList = this.channelsCache[groupId] || [];
    const ch = chList.find(c => c.id === chId);
    if (!ch || ch.groupId !== groupId) { alert('Invalid channel selection.'); return; }

    if (!confirm(`Delete channel "${ch.name}" (${ch.id}) from group "${g.name}"?`)) return;

    this.storage.deleteChannel(chId).subscribe(() => {
      this.storage.getChannelsByGroup(groupId).subscribe(chs => {
        this.channelsCache[groupId] = chs || [];
        if (!this.channelsCache[groupId].length) {
          this.storage.ensureDefaultChannel(groupId).subscribe(() => {
            this.storage.getChannelsByGroup(groupId).subscribe(chs2 => {
              this.channelsCache[groupId] = chs2 || [];
              this.removeChannelId[groupId] = null;
              this.reloadUsersAndGroups();
            });
          });
        } else {
          this.removeChannelId[groupId] = null;
          this.reloadUsersAndGroups();
        }
      });
    });
  }

  private reloadUsersAndGroups(next?: () => void) {
  this.storage.getUsers().subscribe(users => {
    this.allUsers = users || [];
  });

  this.storage.getGroups().subscribe(groups => {
    if (groups) {
      this.allGroups = groups;
      this.computeMyGroups();
      this.refreshRequests();
      if (next) next();
    }
  });
}
}