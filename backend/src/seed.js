require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri   = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB  || 'chatdb';
const FORCE  = (process.env.SEED_FORCE || '').toLowerCase() === 'true';

const usersSeed = [
  { id: 'U1', username: 'Super',   email: 'superuser@gmail.com',          password: '123', role: 'SUPER_ADMIN', groups: ['G1','G2','G3'] },
  { id: 'U2', username: 'Zahra',   email: 'zahraanamkhan@gmail.com',      password: '123', role: 'USER',        groups: ['G1','G2'] },
  { id: 'U3', username: 'Anam',    email: 'anamzahrakhan@gmail.com',      password: '123', role: 'GROUP_ADMIN', groups: ['G1','G2'] },
  { id: 'U4', username: 'Student', email: 'anam.khan@griffithuni.edu.au', password: '123', role: 'USER',        groups: ['G1','G3','G4'] },
];

const groupsSeed = [
  { id: 'G1', name: 'General',     adminIds: ['U1'],           createdBy: 'U1', channelId: ['C1','C2'] },
  { id: 'G2', name: 'Mathematics', adminIds: ['U3','U1'],      createdBy: 'U3', channelId: ['C3','C4'] },
  { id: 'G3', name: 'Science',     adminIds: ['U1'],           createdBy: 'U1', channelId: ['C5','C6','C7'] },
  { id: 'G4', name: 'English',     adminIds: ['U1','U3','U2'], createdBy: 'U1', channelId: ['C8','C9'] },
];

const channelsSeed = [
  { id: 'C_GLOBAL', groupId: 'GLOBAL', name: 'General',    memberId: usersSeed.map(u => u.id) },
  { id: 'C1',       groupId: 'G1',     name: 'Main',       memberId: ['U1','U2'] },
  { id: 'C2',       groupId: 'G1',     name: 'Help',       memberId: ['U1','U2'] },
  { id: 'C3',       groupId: 'G2',     name: 'Algebra',    memberId: ['U1','U2','U3'] },
  { id: 'C4',       groupId: 'G2',     name: 'Calculus',   memberId: ['U1','U2','U3'] },
  { id: 'C5',       groupId: 'G3',     name: 'Biology',    memberId: ['U1','U4'] },
  { id: 'C6',       groupId: 'G3',     name: 'Chemistry',  memberId: ['U1','U4'] },
  { id: 'C7',       groupId: 'G3',     name: 'Physics',    memberId: ['U1','U4'] },
  { id: 'C8',       groupId: 'G4',     name: 'Literature', memberId: ['U1','U3','U2','U4'] },
  { id: 'C9',       groupId: 'G4',     name: 'Vocabulary', memberId: ['U1','U3','U2','U4'] },
];

async function runSeed() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const colUsers    = db.collection('users');
    const colGroups   = db.collection('groups');
    const colChannels = db.collection('channels');

    await Promise.all([
      colUsers.createIndex({ username: 1 }, { unique: true, name: 'uniq_username' }),
      colUsers.createIndex({ email: 1 },    { unique: true, name: 'uniq_email' }),
      colGroups.createIndex({ name: 1 },    { name: 'idx_group_name' }),
      colChannels.createIndex({ groupId: 1, name: 1 }, { name: 'idx_channel_group_name' }),
    ]);

    if (FORCE) {
      await Promise.all([
        colUsers.deleteMany({}),
        colGroups.deleteMany({}),
        colChannels.deleteMany({}),
      ]);
      console.log('Collections cleared due to SEED_FORCE=true');
    }

    const [uCount, gCount, cCount] = await Promise.all([
      colUsers.countDocuments(),
      colGroups.countDocuments(),
      colChannels.countDocuments(),
    ]);
    if (!FORCE && (uCount > 0 || gCount > 0 || cCount > 0)) {
      console.log('Seed skipped (collections already have data).');
      return;
    }

    const userIdMap    = new Map();
    const groupIdMap   = new Map();
    const channelIdMap = new Map();

    usersSeed.forEach(u    => userIdMap.set(u.id,    new ObjectId()));
    groupsSeed.forEach(g   => groupIdMap.set(g.id,   new ObjectId()));
    channelsSeed.forEach(c => channelIdMap.set(c.id, new ObjectId()));

    const globalGroupKey = 'G_GLOBAL';
    groupIdMap.set(globalGroupKey, new ObjectId());

    const usersDocs = usersSeed.map(u => ({
      _id:       userIdMap.get(u.id),
      username:  u.username,
      email:     u.email,
      password:  u.password, 
      role:      u.role,
      groups:    (u.groups || []).map(g => groupIdMap.get(g)).filter(Boolean),
      createdAt: new Date(),
    }));

    const groupsDocs = groupsSeed.map(g => ({
      _id:       groupIdMap.get(g.id),
      name:      g.name,
      ownerId:   userIdMap.get(g.createdBy),
      adminIds:  (g.adminIds || []).map(u => userIdMap.get(u)).filter(Boolean),
      memberIds: [],
      createdAt: new Date(),
    }));

    groupsDocs.push({
      _id:       groupIdMap.get(globalGroupKey),
      name:      'Global',
      ownerId:   userIdMap.get('U1') || usersDocs[0]?._id,
      adminIds:  [],
      memberIds: [],
      createdAt: new Date(),
    });

    const channelsDocs = channelsSeed.map(c => {
      const gid = c.groupId === 'GLOBAL' ? groupIdMap.get(globalGroupKey) : groupIdMap.get(c.groupId);
      return {
        _id:        channelIdMap.get(c.id),
        groupId:    gid,
        name:       c.name,
        isGlobal:   c.groupId === 'GLOBAL',
        memberIds: (c.memberId || []).map(uid => userIdMap.get(uid)).filter(Boolean),
        createdAt:  new Date(),
      };
    });

    // derive group.memberIds from channel members
    const groupMembers = new Map([...groupIdMap.values()].map(gid => [gid.toHexString(), new Set()]));
    for (const c of channelsDocs) {
      const set = groupMembers.get(c.groupId.toHexString());
      c.memberIds.forEach(oid => set.add(oid.toHexString()));
    }
    for (const g of groupsDocs) {
      const set = groupMembers.get(g._id.toHexString());
      g.memberIds = set ? [...set].map(hex => new ObjectId(hex)) : [];
    }

    await colUsers.insertMany(usersDocs, { ordered: false });
    await colGroups.insertMany(groupsDocs, { ordered: false });
    await colChannels.insertMany(channelsDocs, { ordered: false });

    console.log(`Database seed complete: users=${usersDocs.length}, groups=${groupsDocs.length}, channels=${channelsDocs.length}`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runSeed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { runSeed };
