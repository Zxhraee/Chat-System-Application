import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { Group } from '../models/group';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  isSuperAdmin(user: User | null | undefined): boolean {
    return !!user && user.role === 'SUPER_ADMIN';
  }

  isGroupAdmin(user: User | null | undefined): boolean {
    return !!user && user.role === 'GROUP_ADMIN';
  }

  canAdministerGroup(user: User | null | undefined, group: Group | null | undefined): boolean {
    if (!user || !group) return false;
    if (this.isSuperAdmin(user)) return true;

    const userIsGroupAdmin = this.isGroupAdmin(user);

    const createdBy: string | undefined = (group as any).createdBy;
    const creatorIds: string[] | undefined = (group as any).creatorIds;
    const adminIds: string[] | undefined = (group as any).adminId;

    const userIsCreator =
      (createdBy ? createdBy === user.id : false) ||
      (Array.isArray(creatorIds) ? creatorIds.includes(user.id) : false);

    const userListedAsAdmin = Array.isArray(adminIds) && adminIds.includes(user.id);

    return userIsGroupAdmin && (userIsCreator || (!createdBy && !creatorIds && userListedAsAdmin));
  }

  canCreateGroup(user: User | null | undefined): boolean {
    return this.isSuperAdmin(user) || this.isGroupAdmin(user);
  }

  canApprovePromotion(user: User | null | undefined): boolean {
    return this.isSuperAdmin(user);
  }

  canManageGroup(user: User | null | undefined, group: Group | null | undefined): boolean {
    return this.canAdministerGroup(user, group);
  }

  canModifyOrDeleteGroup(u: User | null | undefined, g: Group | null | undefined): boolean {
    if (!u || !g) return false;
    if (this.isSuperAdmin(u)) return true;
    return this.isGroupAdmin(u) && g.createdBy === u.id;
  }
}
