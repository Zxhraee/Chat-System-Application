import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../services/auth.service';
import { GroupsService } from '../../services/groups.service';
import { ChannelsService } from '../../services/channels.service';
import { StorageService } from '../../services/storage.service';

import { Group } from '../../models/group';
import { User } from '../../models/user';
import { Channel } from '../../models/channel';
import { HttpClient } from '@angular/common/http';

type SUser = {
  _id: string;
  username: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER' | string;
  groups?: unknown[];
};


const mapUser = (s: SUser) => ({
  id: s._id,
  username: s.username,
  email: s.email ?? '',
  role: (s.role as any) || 'USER',
  groups: Array.isArray(s.groups)
    ? s.groups.map(g => {
      if (typeof g === 'string') return g;
      if (g && typeof g === 'object') return (g as any).toString?.() ?? (g as any).$oid ?? String(g);
      return String(g);
    })
    : [],
  password: '',
});



@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
})
export class GroupsComponent implements OnInit {
  me: User | null = null;
  isSuper = false;

  allGroups: Group[] = [];
  myGroups: Group[] = [];
  allUsers: User[] = [];

  channelsCache = new Map<string, Channel[]>();

  newGroupName = '';
  upgradeUserIdGlobal: string | null = null;

  addMemberUserId = new Map<string, string | null>();
  promoteUserId = new Map<string, string | null>();
  removeUserId = new Map<string, string | null>();
  banUserId = new Map<string, string | null>();

  banChannel = new Map<string, string>();
  banReason = new Map<string, string>();

  joinRequests = new Map<string, string[]>();
  promoteRequests = new Map<string, string[]>();

  removeUserIdGlobal: string | null = null;
  removeChannelId = new Map<string, string | null>();
  selectedRequestGroupId: string = '';
  pendingByGroup = new Map<string, string[]>();

  constructor(
    private auth: AuthService,
    private groupsSvc: GroupsService,
    private chansSvc: ChannelsService,
    private legacy: StorageService,

    private router: Router,
    private http: HttpClient,
  ) { }

  async ngOnInit() {

    this.me = this.auth.currentUser();
    this.isSuper = this.me?.role === 'SUPER_ADMIN';



    this.legacy.getUsers().subscribe(users => (this.allUsers = users || []));

    this.http.get<SUser[]>('http://localhost:3000/api/users').subscribe({
      next: (arr) => {
        this.allUsers = (arr || []).map(mapUser);

      },
    });


    await this.groupsSvc.refresh();
    this.groupsSvc.groups$.subscribe(async gs => {
      this.allGroups = gs || [];
      this.computeMyGroups();
      this.refreshRequests();
      await this.preloadGeneralChannels();
    });
  }

  async loadChannels(groupId: string) {
    try {
      const list = await this.chansSvc.list(groupId);
      this.channelsCache.set(groupId, list || []);
    } catch {
      this.channelsCache.set(groupId, []);
    }
  }


  getMap(map: Map<string, string | null>, key: string): string | null {
    return map.get(key) ?? null;
  }
  setMap(map: Map<string, string | null>, key: string, val: string | null) {
    map.set(key, val);
  }
  getList(map: Map<string, string[]>, key: string): string[] {
    return map.get(key) ?? [];
  }



  private computeMyGroups(): void {
    const u = this.me;
    if (!u) { this.myGroups = []; return; }

    if (u.role === 'SUPER_ADMIN') {
      this.myGroups = [...(this.allGroups || [])];
      return;
    }
    const isMember = (g: Group) =>
      this.isGeneralGroup(g) ||
      g.createdBy === u.id ||
      (Array.isArray(g.adminIds) && g.adminIds.includes(u.id)) ||
      (Array.isArray(g.memberIds) && g.memberIds.includes(u.id)) ||
      (Array.isArray(u.groups) && u.groups.includes(g.id));


    this.myGroups = (this.allGroups || []).filter(isMember);


    this.myGroups.sort((a, b) => {
      const aGen = this.isGeneralGroup(a) ? 1 : 0;
      const bGen = this.isGeneralGroup(b) ? 1 : 0;
      if (aGen !== bGen) return bGen - aGen;

      return (a.name || '').localeCompare(b.name || '');
    });
  }



  pendingReq = new Set<string>();


  requestPromotion(groupId: string) {
    const targetUserId = this.promoteUserId.get(groupId);
    const requesterId = this.me?.id;
    if (!targetUserId || !requesterId || this.pendingReq.has(groupId)) return;

    this.pendingReq.add(groupId);
    this.groupsSvc.requestPromotion(groupId, targetUserId, requesterId)
      .then(() => {
        this.promoteUserId.set(groupId, null);
        this.refreshRequests();
        alert('Promotion request submitted.');
      })
      .finally(() => this.pendingReq.delete(groupId));
  }




  private refreshRequests(): void {
    this.joinRequests = new Map();
    this.promoteRequests = new Map();

    for (const g of this.allGroups) {
      this.legacy.getJoinRequests(g.id).subscribe(list =>
        this.joinRequests.set(g.id, list || [])
      );

      this.groupsSvc.loadPromotionRequests(g.id)
        .then((res: { requests: string[] }) =>
          this.promoteRequests.set(g.id, res.requests || [])
        )
        .catch(() => this.promoteRequests.set(g.id, []));
    }
  }


  private async preloadGeneralChannels(): Promise<void> {
    const gen = this.generalGroup();
    if (!gen) return;
    const list = await this.chansSvc.list(gen.id).catch(() => []);
    this.channelsCache.set(gen.id, list || []);
  }

  private generalGroup(): Group | null {
    return (
      this.allGroups.find(g => g.id === 'GLOBAL') ||
      this.allGroups.find(g => (g.name || '').toLowerCase() === 'general') ||
      null
    );
  }


  isGeneralGroup(g: Group | null): boolean {
    if (!g) return false;
    return g.id === 'GLOBAL' || (g.name || '').toLowerCase() === 'general';
  }

  isCreator(g: Group): boolean {
    return !!this.me && g.createdBy === this.me.id;
  }

  isAdmin(g: Group): boolean {
    if (!this.me) return false;
    return (g.adminIds ?? []).includes(this.me.id) || this.isSuper;
  }

  canAdmin(g: Group): boolean { return this.isAdmin(g); }
  canModify(g: Group): boolean { return this.isSuper || this.isCreator(g); }
  canCreateGroup(): boolean { return this.isSuper || this.me?.role === 'GROUP_ADMIN'; }

  userInGroup(userId: string, groupId: string): boolean {
    const u = this.allUsers.find(x => x.id === userId);
    const g = this.allGroups.find(x => x.id === groupId);
    if (!u || !g) return false;


    const uid = String(userId);
    const memberIds = (g.memberIds || []).map(m => String(m));
    const adminIds = (g.adminIds || []).map(m => String(m));
    const uGroups = (u.groups || []).map(String);

    if (memberIds.includes(uid)) return true;

    if (uGroups.includes(groupId)) return true;
    if (g.createdBy === uid) return true;
    if (adminIds.includes(uid)) return true;

    return false;
  }

  isInGroup(groupId: string): boolean {
    return !!this.me && this.userInGroup(this.me.id, groupId);
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

  channelsOf(gid: string): Channel[] {
    if (!this.channelsCache.has(gid)) {
      this.channelsCache.set(gid, []);

      this.chansSvc.list(gid)
        .then(list => this.channelsCache.set(gid, list || []))
        .catch(() => this.channelsCache.set(gid, []));
    }

    return this.channelsCache.get(gid)!;
  }


  hasPendingJoin(groupId: string): boolean {
    const meId = this.me?.id;
    if (!meId) return false;
    const list = this.joinRequests.get(groupId) ?? [];
    return list.includes(meId);
  }



  async createGroup() {
    if (!this.me || !this.canCreateGroup()) return;
    const name = this.newGroupName.trim();
    if (!name) return;

    const g = await this.groupsSvc.create(name, this.me.id);

    const first = await this.groupsSvc.createDefaultChannel(g.id);
    this.newGroupName = '';
    await this.groupsSvc.refresh();
    this.router.navigate(['/chat', g.id, first.id]);
  }

  async rename(g: Group) {
    if (!this.canModify(g)) return;
    const name = prompt('New group name', g.name)?.trim();
    if (!name) return;
    await this.groupsSvc.rename(g.id, name);
    await this.groupsSvc.refresh();
  }

  async remove(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.canModify(g) || this.isGeneralGroup(g)) return;
    if (!confirm(`Delete group "${g.name}"?`)) return;
    await this.groupsSvc.delete(groupId);
    await this.groupsSvc.refresh();
  }

  async leave(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId) || null;
    if (this.isGeneralGroup(g) || !this.me) {
      alert('You cannot leave the General group.');
      return;
    }

    const actingRole = this.me.role || 'USER';
    await this.groupsSvc.leave(groupId, this.me.id, actingRole);


    this.me = {
      ...this.me,
      groups: (this.me.groups || []).filter(id => id !== groupId),
    };

    await this.groupsSvc.refresh();
  }


  openChannels(groupId: string) {
    this.router.navigate(['/groups', groupId, 'channels']);
  }

  async addChannel(groupId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.isAdmin(g)) return;
    const name = prompt('Channel name (e.g., "main")', 'main')?.trim();
    if (!name) return;

    await this.chansSvc.create(groupId, name);
    const list = await this.chansSvc.list(groupId).catch(() => []);
    this.channelsCache.set(groupId, list);
  }

  async removeChannel(groupId: string) {
    const selected = this.removeChannelId.get(groupId);
    if (!selected) {
      alert('Please select a channel to remove.');
      return;
    }

    const gid = String(groupId);
    const chId = String(selected);


    let list = await this.chansSvc.list(gid).catch(() => []);
    this.channelsCache.set(gid, list);


    const ch = list.find(c => String(c.id) === chId);


    const g = this.allGroups.find(x => String(x.id) === gid) || null;
    if (!g || !this.canAdmin(g)) {
      alert('You do not have permission to remove channels from this group.');
      return;
    }


    if (!ch) {
      if (!confirm('Channel not found in the local list. Delete anyway?')) return;
      await this.chansSvc.delete(chId);
    } else {
      if (!confirm(`Delete channel "${ch.name}" from group "${g.name}"?`)) return;
      await this.chansSvc.delete(ch.id);
    }


    list = await this.chansSvc.list(gid).catch(() => []);
    if (!list.length) {
      await this.groupsSvc.createDefaultChannel(gid);
      list = await this.chansSvc.list(gid).catch(() => []);
    }

    this.channelsCache.set(gid, list);
    this.removeChannelId.set(groupId, null);
    await this.groupsSvc.refresh();
  }



  async addMemberByUsername(groupId: string) {
    const uid = this.addMemberUserId.get(groupId);
    if (!uid) return;
    await this.groupsSvc.join(groupId, uid);
    this.addMemberUserId.set(groupId, null);
    await this.groupsSvc.refresh();
  }

  async addMember(groupId: string) {
    const userId = this.getMap(this.addMemberUserId, groupId);
    if (!userId) return;

    const g = this.myGroups.find(x => this.str(x.id) === this.str(groupId));


    console.log('Add Member check', {
      groupId: this.str(groupId),
      userId: this.str(userId),
      members: (g?.memberIds || []).map(m => this.str(m))
    });

    if (g && g.memberIds.map(m => this.str(m)).includes(this.str(userId))) {
      return;
    }

    await this.groupsSvc.join(this.str(groupId), this.str(userId));
  }


  async removeMemberFromGroup(groupId: string) {
    const uid = this.removeUserId.get(groupId);
    if (!uid) return alert('Select a user to remove');

    try {
      const actingRole = this.me?.role || 'USER';
      await this.groupsSvc.leave(groupId, uid, actingRole);
      console.log('User removed:', uid);


      const g = this.allGroups.find(x => x.id === groupId);
      if (g) {
        g.memberIds = g.memberIds.filter(m => m !== uid);
        g.adminIds = g.adminIds.filter(m => m !== uid);
      }

      this.removeUserId.set(groupId, null);
      await this.groupsSvc.refresh();
    } catch (err) {
      console.error(' User Remove failed: ', err);
    }
  }




  requestToJoin(groupId: string) {
    if (!this.me) return;
    this.legacy.requestJoinGroup(groupId, this.me.id).subscribe(() => this.refreshRequests());
  }

  approveJoin(groupId: string, userId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.isAdmin(g)) return;


    this.groupsSvc.join(groupId, userId).then(() => {

      this.legacy.rejectJoin(groupId, userId).subscribe(() => {
        this.refreshRequests();
        this.groupsSvc.refresh();
      });
    });
  }


  rejectJoin(groupId: string, userId: string) {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g || !this.isAdmin(g)) return;
    this.legacy.rejectJoin(groupId, userId).subscribe(() => this.refreshRequests());
  }

  approvePromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.groupsSvc.approvePromotion(groupId, userId).then(() => {
      this.refreshRequests();
      this.groupsSvc.refresh();
    });
  }

  rejectPromotion(groupId: string, userId: string) {
    if (!this.isSuper) return;
    this.groupsSvc.rejectPromotion(groupId, userId).then(() => {
      this.refreshRequests();
    });
  }

  promoteNow(groupId: string) {
    if (!this.isSuper) return;
    const uid = this.promoteUserId.get(groupId);
    if (!uid) { alert('Select a user to promote'); return; }


    this.http.post(`http://localhost:3000/api/groups/${groupId}/admins`, { userId: uid })
      .subscribe({
        next: () => {

          this.http.post(`http://localhost:3000/api/users/${uid}/promote`, { role: 'GROUP_ADMIN' })
            .subscribe({
              next: () => {
                this.promoteUserId.set(groupId, null);

                this.groupsSvc.refresh();
                this.http.get<SUser[]>('http://localhost:3000/api/users')
                  .subscribe(arr => this.allUsers = (arr || []).map(mapUser));
              },
              error: e => console.error('promote user role failed', e),
            });
        },
        error: e => console.error('add admin to group failed', e),
      });
  }


  addSuper() {
    if (!this.isSuper) return;
    const uid = this.upgradeUserIdGlobal;
    if (!uid) { alert('Pick a user first'); return; }
    this.legacy.makeSuperAdmin(uid).subscribe({
      next: () => {
        this.upgradeUserIdGlobal = null;
        this.groupsSvc.refresh();
      },
      error: (e) => console.error('Super Admin Promotion failed', e),
    });
  }

  banInChannel(groupId: string) {
    const channelId = this.banChannel.get(groupId);
    const uid = this.banUserId.get(groupId);
    const reason = (this.banReason.get(groupId) || '').trim();
    if (!channelId || !uid || !reason) return;

    const body = { userId: uid, reason, bannedBy: this.me?.id || 'unknown' };

    this.http.post(`http://localhost:3000/api/channels/${channelId}/bans`, body)
      .subscribe({
        next: () => {
          alert('User banned from channel and removed.');
          this.groupsSvc.refresh();

          this.chansSvc.list(groupId);

        },
      });
  }


  private str(x: any): string {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'object') return (x.id ?? x._id ?? x.$oid ?? String(x));
    return String(x);
  }


  getAddableUsers(groupId: string) {
    const g = this.allGroups.find(x => this.str(x.id) === this.str(groupId));
    if (!g) return [];

    const memberSet = new Set((g.memberIds || []).map(m => this.str(m)));


    const adminSet = new Set((g.adminIds || []).map(a => this.str(a)));
    const creatorId = this.str(g.createdBy || g.ownerId);

    return this.allUsers.filter(u => {
      const uid = this.str((u as any).id ?? (u as any)._id);
      return !memberSet.has(uid) && uid !== creatorId && !adminSet.has(uid);
    });
  }


  getPromotableUsers(groupId: string): User[] {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g) return [];
    if (!this.isAdmin(g) && !this.isSuper) return [];

    const memberSet = new Set((g.memberIds || []).map(m => String(m)));
    const adminSet = new Set((g.adminIds || []).map(m => String(m)));
    const creatorId = String(g.createdBy || g.ownerId);

    return this.allUsers
      .filter(u => {
        const uid = String(u.id);
        return memberSet.has(uid)

          && uid !== creatorId

          && !adminSet.has(uid)
          && u.role !== 'SUPER_ADMIN'
          && uid !== this.me?.id;
      })
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  }


  getDeletableUsersInGroup(groupId: string): User[] {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g) return [];

    if (!this.isAdmin(g)) return [];
    return this.allUsers.filter(u =>
      this.userInGroup(u.id, groupId) && u.id !== this.me?.id
    );
  }
  getRemovableUsers(groupId: string): User[] {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g) return [];

    const ownerId = String(g.createdBy || g.ownerId || '');
    const meId = String(this.me?.id || '');


    const memberIds = new Set((g.memberIds || []).map(m => String(m)));
    const adminIds = new Set((g.adminIds || []).map(m => String(m)));
    const allInGroup = new Set([...memberIds, ...adminIds, ownerId].filter(Boolean));


    if (this.isSuper) {
      return this.allUsers
        .filter(u => allInGroup.has(String(u.id)))

        .filter(u => String(u.id) !== meId);

    }



    if (this.isAdmin(g)) {
      return this.allUsers
        .filter(u => allInGroup.has(String(u.id)))
        .filter(u => !adminIds.has(String(u.id)))
        .filter(u => String(u.id) !== ownerId)
        .filter(u => String(u.id) !== meId);
    }

    return [];
  }


  getBannableUsers(groupId: string): User[] {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g) return [];
    if (!this.isAdmin(g)) return [];
    return this.allUsers.filter(u =>
      this.userInGroup(u.id, groupId) && u.id !== this.me?.id
    );
  }

  removeAnyUserGlobal() {
    if (!this.isSuper) return;
    const uid = this.removeUserIdGlobal;
    if (!uid) return;

    this.http.delete(`http://localhost:3000/api/users/${uid}`).subscribe({
      next: () => {
        this.removeUserIdGlobal = null;
        alert('User removed successfully.');

        this.http.get<SUser[]>('http://localhost:3000/api/users').subscribe({
          next: (arr) => (this.allUsers = (arr || []).map(mapUser)),
          complete: () => this.groupsSvc.refresh(),
        });
      },
      error: (e) => {
        alert('Failed to remove user.');
      }
    });

  }

  removeAnyUser(groupId: string): void {
    const uid = this.removeUserId.get(groupId);
    if (!uid) { alert('Select a user to remove'); return; }

    const actingRole = this.isSuper ? 'SUPER_ADMIN' : (this.me?.role || 'USER');

    this.groupsSvc.leave(groupId, uid, actingRole).then(() => {
      this.removeUserId.set(groupId, null);
      this.groupsSvc.refresh();
    });
  }


}
