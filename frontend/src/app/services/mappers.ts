import { User } from '../models/user';
import { Group } from '../models/group';
import { Channel } from '../models/channel';
import { Message } from '../models/message';

export type ServerId = string;

//Server Side User, Group, Channel Message Shape
export type SUser = {
  _id: ServerId;
  username: string;
  email: string;
  role: 'SUPER_ADMIN'|'GROUP_ADMIN'|'USER';
  groups?: ServerId[];
  createdAt?: string;
};

export type SGroup = {
  _id: ServerId;
  name: string;
  ownerId: ServerId;
  adminIds: ServerId[];
  memberIds: ServerId[];
  createdAt?: string;
};

export type SChannel = {
  _id: ServerId;
  groupId: ServerId;
  name: string;
  isGlobal?: boolean;
  createdAt?: string;
};

export type SMessage = {
  _id: ServerId;
  channelId: ServerId;
  senderId: ServerId;
  username?: string;
  body: string;          
  meta?: any;
  createdAt: string;   
};

//Normalise server object to client object
export const mapUser = (s: SUser): User => ({
  id: s._id, 
  username: s.username,
  email: s.email,
  password: '',  
  role: s.role,
  groups: (s.groups || []).map(String),
});

export const mapGroup = (s: SGroup): Group => ({
  id: s._id,
  name: s.name,
  ownerId: String(s.ownerId),              
  adminIds: (s.adminIds || []).map(String),
  memberIds: (s.memberIds || []).map(String), 
  createdAt: s.createdAt,
  createdBy: String(s.ownerId),
});


export const mapChannel = (s: SChannel): Channel => ({
  id: s._id,
  groupId: String(s.groupId),
  name: s.name,
  memberIds: [], 
});

export const mapMessage = (s: SMessage): Message => ({
  id: s._id,
  channelId: String(s.channelId),
  userId: String(s.senderId),
  username: s.username || s.senderId,
  text: s.body,
  timestamp: new Date(s.createdAt).getTime(),
});
