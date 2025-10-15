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

//Client User Map
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

  banChannel = new Map<string, string | null>();
  banReason = new Map<string, string>();

  joinRequests = new Map<string, string[]>();
  promoteRequests = new Map<string, string[]>();

  removeUserIdGlobal: string | null = null;
  removeChannelId = new Map<string, string | null>();
  selectedRequestGroupId: string = '';
  pendingByGroup = new Map<string, string[]>();
  bannedByGroupChannel = new Map<string, Set<string>>();
  bannedByChannel = new Map<string, Set<string>>();

  private pendingUnban = new Set<string>();
  private unbanKey = (chId: string, userId: string) => `${String(chId)}|${String(userId)}`;

  constructor(
    private auth: AuthService,
    private groupsSvc: GroupsService,
    private chansSvc: ChannelsService,
    private legacy: StorageService,
    private storage: StorageService,
    private router: Router,
    private http: HttpClient,
  ) { }

  banReportsAll: Array<{
    groupId: string; groupName: string;
    channelId: string; channelName: string;
    userId: string; username: string;
    bannedBy: string; bannedByName: string;
    reason: string; createdAt: string;
  }> = [];

  async ngOnInit() {

    //Load current user 
    this.me = this.auth.currentUser();
    this.isSuper = this.me?.role === 'SUPER_ADMIN';

    //Load ban reports
    if (this.isSuper) {
      this.http.get<any>('http://localhost:3000/api/admin/ban-reports')
        .subscribe({
          next: (res) => {
            const rows = Array.isArray(res) ? res : (res ? [res] : []);
            this.banReportsAll = rows.map(r => ({
              groupId: String(r.groupId || ''),
              groupName: r.groupName || '',
              channelId: String(r.channelId || ''),
              channelName: r.channelName || '',
              userId: String(r.userId || ''),
              username: r.username || '',
              bannedBy: String(r.bannedBy || ''),
              bannedByName: r.bannedByName || '',
              reason: r.reason || '',
              createdAt: r.createdAt || new Date().toISOString(),
            }));
          },
          error: (e) => {
            console.error('ban reports load failed', e);
            this.banReportsAll = [];
          }
        });
    }


    this.legacy.getUsers().subscribe(users => (this.allUsers = users || []));
    //Fetch users
    this.http.get<SUser[]>('http://localhost:3000/api/users').subscribe({
      next: (arr) => {
        this.allUsers = (arr || []).map(mapUser);

      },
    });

    //Refresh groups
    await this.groupsSvc.refresh();
    this.groupsSvc.groups$.subscribe(async gs => {
      this.allGroups = gs || [];
      this.computeMyGroups();
      this.refreshRequests();
      await this.preloadGeneralChannels();
    });
  }

  //Load channels
  async loadChannels(groupId: string) {
    try {
      const list = await this.chansSvc.list(groupId);
      this.channelsCache.set(groupId, list || []);
    } catch {
      this.channelsCache.set(groupId, []);
    }
  }

  //Map Ui helpers
  getMap(map: Map<string, string | null>, key: string): string | null {
    return map.get(key) ?? null;
  }
  setMap(map: Map<string, string | null>, key: string, val: string | null) {
    map.set(key, val);
  }
  getList(map: Map<string, string[]>, key: string): string[] {
    return map.get(key) ?? [];
  }


  //Build Groups
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

  //Unban for Super
  isUnbanning(channelId: string, userId: string): boolean {
    return this.pendingUnban.has(this.unbanKey(channelId, userId));
  }
  unbanInSelectedChannel(groupId: string, userId: string): void {
    if (!this.isSuper) return;

    const ch = this.selectedChannel(groupId);
    if (!ch) { alert('Select a channel first'); return; }

    const chId = this.str(ch.id);
    const key = this.unbanKey(chId, userId);

    if (this.pendingUnban.has(key)) return;
    this.pendingUnban.add(key);

    this.http.delete(`http://localhost:3000/api/channels/${chId}/bans/${userId}`)
      .subscribe({
        next: () => {
          const set = this.bannedByChannel.get(chId) || new Set<string>();
          set.delete(this.str(userId));
          this.bannedByChannel.set(chId, set);


          this.loadBans(chId);

          this.pendingUnban.delete(key);
        },
        error: (e) => {
          console.error('unban failed', e);
          this.pendingUnban.delete(key);
          alert('Failed to unban. Check server logs.');
        }
      });
  }
  hasSelectedBanChannel(groupId: string): boolean {
    return !!this.getMap(this.banChannel, groupId);
  }

  //Promotion Request 
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

  //Load Channel Bans
  loadBans(channelId: string): void {
    this.storage.getChannelBans(channelId).subscribe({
      next: (rows: { userId: string }[]) => {
        const ids = (rows || []).map((r: { userId: string }) => String(r.userId));
        this.bannedByChannel.set(channelId, new Set(ids));
      },
      error: (e) => console.error('getChannelBans failed', e),
    });
  }

  //Refresh Pending Requests
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

  //Preload General Group Channels
  private async preloadGeneralChannels(): Promise<void> {
    const gen = this.generalGroup();
    if (!gen) return;
    const list = await this.chansSvc.list(gen.id).catch(() => []);
    this.channelsCache.set(gen.id, list || []);
  }

  //Find General Group
  private generalGroup(): Group | null {
    return (
      this.allGroups.find(g => g.id === 'GLOBAL') ||
      this.allGroups.find(g => (g.name || '').toLowerCase() === 'general') ||
      null
    );
  }

  //Select Channel for Ban
  onBanChannelChange(groupId: string, channelId: string | null) {
    if (channelId) this.loadBans(channelId);
    this.banUserId.set(groupId, null);
  }

  private selectedChannel(groupId: string): Channel | null {
    const chId = this.getMap(this.banChannel, groupId);
    if (!chId) return null;
    const list = this.channelsOf(groupId);
    return list.find(c => this.str(c.id) === this.str(chId)) || null;
  }

  //Users that can be banned
  bannableUsersForSelectedChannel(groupId: string): User[] {
    const ch = this.selectedChannel(groupId);
    if (!ch) return [];

    const chId = this.str(ch.id);
    const banned = this.bannedByChannel.get(chId) || new Set<string>();
    const memberSet = new Set((ch as any).memberIds?.map((m: any) => this.str(m)) || []);
    const meId = this.str(this.me?.id);

    return this.allUsers
      .filter(u => memberSet.has(this.str(u.id)))
      .filter(u => !banned.has(this.str(u.id)))
      .filter(u => (u.role || '').toUpperCase() !== 'SUPER_ADMIN')
      .filter(u => this.str(u.id) !== meId)
      .filter(u => this.isSuper || (u.role || '').toUpperCase() !== 'GROUP_ADMIN')
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  }

  // Role or Membership helpers
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

  //Check for User in Group
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
  // Check User Group
  isInGroup(groupId: string): boolean {
    return !!this.me && this.userInGroup(this.me.id, groupId);
  }

  openAdminFor: string | null = null;

  isAdminOpen(groupId: string): boolean {
    return this.openAdminFor === groupId;
  }

  toggleAdmin(groupId: string): void {
    this.openAdminFor = this.openAdminFor === groupId ? null : groupId;
  }

  //Joinable Groups
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
  displayName(u: User): string { return `${u.username}`; }

  channelsOf(gid: string): Channel[] {
    if (!this.channelsCache.has(gid)) {
      this.channelsCache.set(gid, []);

      this.chansSvc.list(gid)
        .then(list => this.channelsCache.set(gid, list || []))
        .catch(() => this.channelsCache.set(gid, []));
    }

    return this.channelsCache.get(gid)!;
  }

  //User Pending Join Check
  hasPendingJoin(groupId: string): boolean {
    const meId = this.me?.id;
    if (!meId) return false;
    const list = this.joinRequests.get(groupId) ?? [];
    return list.includes(meId);
  }


  // Group Functions
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

  //Find Users Selectable for Adding to Channel
  getSelectableUsers(channelId: string, group: Group, allUsers: User[]) {
    const banned = this.bannedByChannel.get(channelId) || new Set<string>();
    const memberIds = new Set(group.memberIds.map(String));
    return allUsers
      .filter(u => memberIds.has(u.id))
      .filter(u => !banned.has(u.id));
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

    //Delete Channel
    if (!ch) {
      if (!confirm('Channel not found in the local list. Delete anyway?')) return;
      await this.chansSvc.delete(chId);
    } else {
      if (!confirm(`Delete channel "${ch.name}" from group "${g.name}"?`)) return;
      await this.chansSvc.delete(ch.id);
    }

    //Create Default Channel
    list = await this.chansSvc.list(gid).catch(() => []);
    if (!list.length) {
      await this.groupsSvc.createDefaultChannel(gid);
      list = await this.chansSvc.list(gid).catch(() => []);
    }

    this.channelsCache.set(gid, list);
    this.removeChannelId.set(groupId, null);
    await this.groupsSvc.refresh();
  }


  //Membership
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



  // Join and Promote Requests and Approvals
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

  //Promote to Super
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

  //Ban in Channel
  banInChannel(groupId: string) {
    const channelId = this.getMap(this.banChannel, groupId);
    const targetId = this.banUserId.get(groupId);
    const reason = (this.banReason.get(groupId) || '').trim();
    if (!channelId || !targetId || !reason) return;

    const meName = this.me?.username || '';
    const meFromDb = this.allUsers.find(u => u.id === this.me?.id)
      || this.allUsers.find(u => u.username === meName);
    if (!meFromDb) {
      alert('Your user was not found in the database. Please re-login.');
      return;
    }

    const body = { userId: targetId, reason, bannedBy: meFromDb.id };

    this.http.post(`http://localhost:3000/api/channels/${channelId}/bans`, body)
      .subscribe({
        next: () => {
          this.loadBans(String(channelId));
          this.banUserId.set(groupId, null);
          alert('User banned from channel and removed.');
        },
        error: e => console.error('ban failed', e)
      });
  }


  private str(x: any): string {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'object') return (x.id ?? x._id ?? x.$oid ?? String(x));
    return String(x);
  }

  //Users that have not yet joined the group
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

  //Users that can be promoted to Admin
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

  //Get Users that can be banned
  getBannableUsers(groupId: string): User[] {
    const g = this.allGroups.find(x => x.id === groupId);
    if (!g) return [];
    if (!this.isAdmin(g)) return [];
    return this.allUsers.filter(u =>
      this.userInGroup(u.id, groupId) && u.id !== this.me?.id
    );
  }

  //Users that are banned
  getBannedUsers(groupId: string): User[] {
    if (!this.isSuper) return [];
    const ch = this.selectedChannel(groupId);
    if (!ch) return [];
    const chId = this.str(ch.id);
    const banned = this.bannedByChannel.get(chId) || new Set<string>();
    return this.allUsers
      .filter(u => banned.has(this.str(u.id)))
      .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  }

  //Remove user from System
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

  openGroupId: string | null = null;

  toggleOpen(id: string): void {
    this.openGroupId = (this.openGroupId === id) ? null : id;
  }

  //Remove user from group
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
