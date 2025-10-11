import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { StorageService } from './storage.service';
import { Group } from '../models/group';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  constructor(private store: StorageService) {}


  isSuperAdmin(u: User | null): boolean {
    return !!u && u.role === 'SUPER_ADMIN';
  }


  isGroupAdmin(u: User | null, g: Group | null): boolean {
    return !!u && !!g && (g.adminIds.includes(u.id) || this.isSuperAdmin(u));
  }

 
  canAdministerGroup(u: User | null, g: Group | null): boolean {
    return this.isGroupAdmin(u, g);
  }

  canModifyGroup(u: User | null, g: Group | null): boolean {
    if (!u || !g) return false;
    if (this.isSuperAdmin(u)) return true;
    return g.createdBy === u.id;
  }
}