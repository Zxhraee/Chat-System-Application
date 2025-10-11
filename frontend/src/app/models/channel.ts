export interface Channel {
  id: string;
  groupId: string;
  name: string;
  isGlobal?: boolean;
  createdAt?: string;
  memberIds?: string[];
}

