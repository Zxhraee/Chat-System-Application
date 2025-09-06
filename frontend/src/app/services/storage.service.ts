import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { Channel } from '../models/channel';
import { Group } from '../models/group';
import { ChatMessage } from '../models/message';

type Requests = Record<string, { join: string[]; promote: string[] }>; 
type Bans = Record<string, string[]>;
type Reports = Array<{ channelId: string; bannerId: string; bannedId: string; reason: string; ts: number }>

@Injectable({ providedIn: 'root' })
export class StorageService {

  Keys = {
    User: 'key_users',
    Group: 'key_groups',
    Channel: 'key_channels',
    Session: 'key_session',
    Messages: 'key_messages',
    RegisterRequests: 'key_register_requests',
    Bans: 'key_bans',
    IdCounters: 'key_id_counters',
    Reports: 'key_reports',
  } as const;

  constructor(){ if(!localStorage.getItem(this.Keys.User)){ this.seed(); } }

  private seed(){
    const users: User[] = [
      { id:'U1', username:'super', email:'superuser@gmail.com', password:'123', role:'SUPER_ADMIN', groups:['G1','G2','G3'] },
      { id:'U2', username:'Zahra', email:'zahraanamkhan@gmail.com', password:'123', role:'USER', groups:['G1','G2'] },
      { id:'U3', username:'Anam',  email:'anamzahrakhan@gmail.com', password:'123', role:'GROUP_ADMIN', groups:['G2'] },
      { id:'U4', username:'Student', email:'anam.khan@griffithuni.edu.au', password:'123', role:'USER', groups:['G3'] },
    ];

    const groups: Group[] = [
      { id:'G1', name:'General',     adminIds:['U1'],       createdBy:'U1', channelId:['C1','C2'] },
      { id:'G2', name:'Mathematics', adminIds:['U3','U1'],  createdBy:'U3', channelId:['C3','C4'] },
      { id:'G3', name:'Science',     adminIds:['U1'],       createdBy:'U1', channelId:['C5','C6','C7'] },
    ];

    const channels: Channel[] = [
      { id:'C1', groupId:'G1', name:'Main',     memberId:['U1','U2'] },
      { id:'C2', groupId:'G1', name:'Help',     memberId:['U1','U2'] },
      { id:'C3', groupId:'G2', name:'Algebra',  memberId:['U2','U3'] },
      { id:'C4', groupId:'G2', name:'Calculus', memberId:['U2','U3'] },
      { id:'C5', groupId:'G3', name:'Biology',  memberId:['U1','U4'] },
      { id:'C6', groupId:'G3', name:'Chemistry',memberId:['U1','U4'] },
      { id:'C7', groupId:'G3', name:'Physics',  memberId:['U1','U4'] },
    ];

    localStorage.setItem(this.Keys.User, JSON.stringify(users));
    localStorage.setItem(this.Keys.Group, JSON.stringify(groups));
    localStorage.setItem(this.Keys.Channel, JSON.stringify(channels));
    localStorage.setItem(this.Keys.Messages, JSON.stringify([]));
    localStorage.setItem(this.Keys.RegisterRequests, JSON.stringify({}));
    localStorage.setItem(this.Keys.Bans, JSON.stringify({}));
    localStorage.setItem(this.Keys.Reports, JSON.stringify([]));
    localStorage.setItem(this.Keys.Session, 'null');
    localStorage.setItem(this.Keys.IdCounters, JSON.stringify({ U:5, G:4, C:8, M:1 }));
  }

  getUsers(): User[] { return JSON.parse(localStorage.getItem(this.Keys.User) || '[]'); }
  setUsers(users: User[]) { localStorage.setItem(this.Keys.User, JSON.stringify(users)); }
  getUserById(id: string): User | undefined { return this.getUsers().find(u => u.id === id); }
  getUserByUsername(username: string): User | undefined { return this.getUsers().find(u => u.username === username); }

  createUser(username: string, email: string, password: string): User | null {
    username = username.trim();
    if (!username || !email.trim() || !password.trim()) return null;
    if (this.getUserByUsername(username)) return null; 

    const users = this.getUsers();
    const id = this.nextId('U');
    const u: User = { id, username, email, password, role:'USER', groups: [] };
    users.push(u);
    this.setUsers(users);
    return u;
  }

  deleteUser(userId: string): boolean {
    const users = this.getUsers().filter(u => u.id !== userId);
    this.setUsers(users);
    const groups = this.getGroups();
    groups.forEach(g => g.adminIds = g.adminIds.filter(id => id !== userId));
    this.setGroups(groups);
    const msgs = this.getAllMessages().filter(m => m.userId !== userId);
    this.setAllMessages(msgs);
    return true;
  }

  setUserRole(userId: string, role: User['role']) {
    const users = this.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return;
    u.role = role;
    this.setUsers(users);
  }

  getGroups(): Group[] { return JSON.parse(localStorage.getItem(this.Keys.Group) || '[]'); }
  setGroups(groups: Group[]) { localStorage.setItem(this.Keys.Group, JSON.stringify(groups)); }
  getGroupById(id: string): Group | null {
    return this.getGroups().find(g => g.id === id) ?? null;
  }

  addGroup(name: string, creatorId: string): Group {
    const groups = this.getGroups();
    const id = this.nextId('G');
    const g: Group = { id, name, adminIds: [creatorId], createdBy: creatorId, channelId: [] };
    groups.push(g);
    this.setGroups(groups);

    const users = this.getUsers();
    const creator = users.find(u => u.id === creatorId);
    if (creator && !creator.groups.includes(id)) {
      creator.groups.push(id);
      this.setUsers(users);
    }
    return g;
  }

  renameGroup(groupId: string, name: string): Group | null {
    const groups = this.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return null;
    g.name = name.trim();
    this.setGroups(groups);
    return g;
  }

  deleteGroup(groupId: string): boolean {
    const groups = this.getGroups().filter(g => g.id !== groupId);
    this.setGroups(groups);
    const users = this.getUsers();
    users.forEach(u => u.groups = u.groups.filter(id => id !== groupId));
    this.setUsers(users);
    const msgs = this.getAllMessages();
    this.setAllMessages(msgs);
    const req = this.getRequests();
    delete req[groupId];
    this.setRequests(req);
    return true;
  }

  getGroupsForUser(userId: string): Group[] {
    const u = this.getUsers().find(x => x.id === userId);
    if (!u) return [];
    return this.getGroups().filter(g => u.groups.includes(g.id));
  }

  addUserToGroup(groupId: string, userId: string): boolean {
    const users = this.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return false;
    if (!u.groups.includes(groupId)) u.groups.push(groupId);
    this.setUsers(users);
    return true;
  }

  removeUserFromGroup(groupId: string, userId: string): boolean {
    const users = this.getUsers();
    const u = users.find(x => x.id === userId);
    if (!u) return false;
    u.groups = u.groups.filter(id => id !== groupId);
    this.setUsers(users);
    return true;
  }

  addAdminToGroup(groupId: string, userId: string): boolean {
    const groups = this.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return false;
    if (!g.adminIds.includes(userId)) g.adminIds.push(userId);
    this.setGroups(groups);
    return true;
  }

  removeAdminFromGroup(groupId: string, userId: string): boolean {
    const groups = this.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return false;
    g.adminIds = g.adminIds.filter(id => id !== userId);
    this.setGroups(groups);
    return true;
  }



  getSession(): { userId: string } | null {
    return JSON.parse(localStorage.getItem(this.Keys.Session) || 'null');
  }
  setSession(v: { userId: string } | null) {
    localStorage.setItem(this.Keys.Session, JSON.stringify(v));
  }

  getCurrentUser(): User | null {
    const session = this.getSession();
    if (!session?.userId) return null;
    return this.getUsers().find(user => user.id === session.userId) || null;
  }

  private getAllMessages(): ChatMessage[] {
    const raw = localStorage.getItem(this.Keys.Messages);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data as ChatMessage[];
  
      if (data && typeof data === 'object') {
        const arr = Object.values(data as Record<string, ChatMessage[] | ChatMessage>).flat();
        return Array.isArray(arr) ? (arr as ChatMessage[]) : [];
      }
      return [];
    } catch {
      return [];
    }
  }
  
  private setAllMessages(msgs: ChatMessage[]) {
    localStorage.setItem(this.Keys.Messages, JSON.stringify(Array.isArray(msgs) ? msgs : []));
  }
  
  getMessagesForChannel(channelId: string): ChatMessage[] {
    return this.getAllMessages()
      .filter(m => m.channelId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  sendMessage(channelId: string, authorId: string, text: string): ChatMessage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (this.isBanned(channelId, authorId)) return null;

    const user = this.getUsers().find(u => u.id === authorId);
    const username = user?.username ?? authorId;

    const msg: ChatMessage = {
      id: this.nextId('M'),
      channelId,
      userId: authorId,
      username,
      text: trimmed,
      timestamp: Date.now(),
    };

    const msgs = this.getAllMessages();
    msgs.push(msg);
    this.setAllMessages(msgs);
    return msg;
  }

  private getRequests(): Requests { return JSON.parse(localStorage.getItem(this.Keys.RegisterRequests) || '{}'); }
  private setRequests(v: Requests) { localStorage.setItem(this.Keys.RegisterRequests, JSON.stringify(v)); }

  requestJoinGroup(groupId: string, userId: string) {
    const req = this.getRequests();
    req[groupId] ||= { join: [], promote: [] };
    if (!req[groupId].join.includes(userId)) req[groupId].join.push(userId);
    this.setRequests(req);
  }
  getJoinRequests(groupId: string): string[] { return this.getRequests()[groupId]?.join ?? []; }
  approveJoin(groupId: string, userId: string) {
    this.addUserToGroup(groupId, userId);
    const req = this.getRequests();
    if (req[groupId]) req[groupId].join = req[groupId].join.filter(id => id !== userId);
    this.setRequests(req);
  }
  rejectJoin(groupId: string, userId: string) {
    const req = this.getRequests();
    if (req[groupId]) req[groupId].join = req[groupId].join.filter(id => id !== userId);
    this.setRequests(req);
  }

  requestPromotion(groupId: string, userId: string) {
    const req = this.getRequests();
    req[groupId] ||= { join: [], promote: [] };
    if (!req[groupId].promote.includes(userId)) req[groupId].promote.push(userId);
    this.setRequests(req);
  }
  getPromotionRequests(groupId: string): string[] { return this.getRequests()[groupId]?.promote ?? []; }
  approvePromotion(groupId: string, userId: string) {
    this.addAdminToGroup(groupId, userId);
    const req = this.getRequests();
    if (req[groupId]) req[groupId].promote = req[groupId].promote.filter(id => id !== userId);
    this.setRequests(req);
  }
  rejectPromotion(groupId: string, userId: string) {
    const req = this.getRequests();
    if (req[groupId]) req[groupId].promote = req[groupId].promote.filter(id => id !== userId);
    this.setRequests(req);
  }

  private getBans(): Bans { return JSON.parse(localStorage.getItem(this.Keys.Bans) || '{}'); }
  private setBans(v: Bans) { localStorage.setItem(this.Keys.Bans, JSON.stringify(v)); }
  isBanned(channelId: string, userId: string): boolean {
    const b = this.getBans()[channelId] ?? [];
    return b.includes(userId);
  }
  banUser(channelId: string, userId: string): void {
    const b = this.getBans();
    b[channelId] = b[channelId] ?? [];
    if (!b[channelId].includes(userId)) b[channelId].push(userId);
    this.setBans(b);
  }
  unbanUser(channelId: string, userId: string): void {
    const b = this.getBans();
    b[channelId] = (b[channelId] ?? []).filter(id => id !== userId);
    this.setBans(b);
  }

  private getReports(): Reports { return JSON.parse(localStorage.getItem(this.Keys.Reports) || '[]'); }
  private setReports(r: Reports) { localStorage.setItem(this.Keys.Reports, JSON.stringify(r)); }
  reportBan(channelId: string, bannerId: string, bannedId: string, reason: string) {
    const r = this.getReports();
    r.push({ channelId, bannerId, bannedId, reason, ts: Date.now() });
    this.setReports(r);
  }
  getAllReports(): Reports { return this.getReports(); }

  private nextId(prefix: 'U' | 'G' | 'C' | 'M'): string {
    const counters = JSON.parse(localStorage.getItem(this.Keys.IdCounters) || '{"U":1,"G":1,"C":1,"M":1}');
    counters[prefix] = (counters[prefix] || 0) + 1;
    localStorage.setItem(this.Keys.IdCounters, JSON.stringify(counters));
    return `${prefix}${counters[prefix]}`;
  }
}
