const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(3000, () => {
  console.log('Backend listening on http://localhost:3000');
});

const USERS = [
  { id: 'U1', username: 'super', email: 'superuser@gmail.com', roles: ['SUPER_ADMIN'], groups: ['G1','G2','G3'] },
  { id: 'U2', username: 'zahra', email: 'zahraanamkhan@gmail.com', roles: ['USER'], groups: ['G1','G2'] },
  { id: 'U3', username: 'anam',  email: 'anamzahrakhan@gmail.com', roles: ['GROUP_ADMIN'], groups: ['G2'] },
  { id: 'U4', username: 'student',  email: 'anam.khan@griffithuni.edu.au', roles: ['USER'], groups: ['G3'] },
];

const GROUPS = [
  { id: 'G1', name: 'General',     ownerId: 'U1', adminIds: ['U1'] },
  { id: 'G2', name: 'Mathematics', ownerId: 'U3', adminIds: ['U3','U1'] },
  { id: 'G3', name: 'Science',     ownerId: 'U1', adminIds: ['U1'] },
];

const CHANNELS = [
  { id: 'C1',  groupId: 'g1', name: 'Main' },
  { id: 'C2',  groupId: 'g1', name: 'Help' },
  { id: 'C3',  groupId: 'g2', name: 'Algebra' },
  { id: 'C4',  groupId: 'g2', name: 'Calculus' },
  { id: 'C5',  groupId: 'g3', name: 'Biology' },
  { id: 'C6',  groupId: 'g3', name: 'Chemistry' },
  { id: 'C7',  groupId: 'g3', name: 'Physics' },
];

let nextU = 5, nextG = 4, nextC = 8;
const newUserId    = () => `U${nextU++}`;
const newGroupId   = () => `G${nextG++}`;
const newChannelId = () => `C${nextC++}`;
