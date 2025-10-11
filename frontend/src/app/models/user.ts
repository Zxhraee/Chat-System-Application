export interface User {
    id: string;
    username: string;
    email: string;
    password: string;
    role: 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'USER'; 
    groups: string[];
    avatarUrl?: string;
  }
  