import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { StorageService } from './storage.service';
import { Group } from '../models/group';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  constructor(private store: StorageService) {}

  //Check User Super
  isSuperAdmin(u: User | null): boolean {
    return !!u && u.role === 'SUPER_ADMIN';
  }

  //Check User Admin
  isGroupAdmin(u: User | null, g: Group | null): boolean {
    return !!u && !!g && (g.adminIds.includes(u.id) || this.isSuperAdmin(u));
  }

  //Check Group Admin
  canAdministerGroup(u: User | null, g: Group | null): boolean {
    return this.isGroupAdmin(u, g);
  }

  //Check User Modify Group
  canModifyGroup(u: User | null, g: Group | null): boolean {
    if (!u || !g) return false;
    if (this.isSuperAdmin(u)) return true;
    return g.createdBy === u.id;
  }
}