import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { Channel } from '../models/channel';
import { Group } from '../models/group';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private User='key_users';
  private Group='key_groups'; 
  private Channel='key_channels'; 
  private Session='key_session';

  constructor(){ if(!localStorage.getItem(this.User)){ this.seed(); } }

  private seed(){
    const superUser = { 
      id: crypto.randomUUID(), 
      username:'super', 
      email:'superuser@gmail.com',
      password:'123', 
      role:'SUPER_ADMIN', 
      groups:[] };
      
    localStorage.setItem(this.User, JSON.stringify([superUser]));
    localStorage.setItem(this.Group, '[]'); localStorage.setItem(this.Channel, '[]');
    localStorage.setItem(this.Session, 'null');
  }

  getUsers(): User[] {
    return JSON.parse(localStorage.getItem(this.User) || '[]');
  }
  setUsers(users: User[]) {
    localStorage.setItem(this.User, JSON.stringify(users));
  }

  getGroups(): Group[] {
    return JSON.parse(localStorage.getItem(this.Group) || '[]');
  }
  setGroups(groups: Group[]) {
    localStorage.setItem(this.Group, JSON.stringify(groups));
  }

  getChannels(): Channel[] {
    return JSON.parse(localStorage.getItem(this.Channel) || '[]');
  }
  setChannels(channels: Channel[]) {
    localStorage.setItem(this.Channel, JSON.stringify(channels));
  }

  getSession(): { userId: string } | null {
    return JSON.parse(localStorage.getItem(this.Session) || 'null');
  }
  setSession(v: { userId: string } | null) {
    localStorage.setItem(this.Session, JSON.stringify(v));
  }
}