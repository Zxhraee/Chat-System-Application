async function buildServer() {
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const { connectDB, ensureCollections } = require('./db/init');
  const { asId, isNonEmptyString } = require('./db/helper');
  const http = require('http');
  const { Server } = require('socket.io');
  const { runSeed } = require('./seed');

const bothIds = (raw) => {
  const oid = asId(String(raw || ''));
  return oid ? [oid, oid.toHexString()] : [String(raw || '')];
};
const idFilter = (raw) => {
  const arr = bothIds(raw).filter(Boolean);
  return arr.length > 1 ? { _id: { $in: arr } } : { _id: arr[0] };
};
const notSelfById = (raw) => ({ _id: { $nin: bothIds(raw).filter(Boolean) } });
const toIdStr = (x) => (x?._id?.toHexString ? x._id.toHexString() : String(x?._id ?? ''));


  const app = express();
  app.use(cors({ origin: 'http://localhost:4200' }));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  const path = require('path');
  const fs = require('fs');

  const uploadsDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));
  app.use(express.json({ limit: '6mb' }));
  app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:4200',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  const toHex = (x) => (x?.toHexString?.() ?? String(x || ''));


  const db = await connectDB();
  await ensureCollections(db);
  await ensurePromoteRequestsArray(db);

  if (process.env.SEED_ON_START === 'true') {
    await runSeed();
  }

  const users = db.collection('users');
  const groups = db.collection('groups');
  const channels = db.collection('channels');
  const messages = db.collection('messages');
  const bans = db.collection('bans');

  await bans.createIndex({ channelId: 1, userId: 1 }, { unique: true }).catch(() => { });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('chat:join', async ({ channelId, user }) => {
      try {
        const cId = asId(channelId);
        const uId = asId(user?.id);
        if (!cId) return;

        if (uId) {
          const isBanned = await bans.findOne({ channelId: cId, userId: uId });
          if (isBanned) {
            socket.emit('chat:denied', { channelId: toHex(cId), reason: 'banned' });
            return;
          }
        }

        const room = `channel:${String(channelId)}`;
        for (const r of socket.rooms) if (r.startsWith('channel:')) socket.leave(r);
        socket.join(room);
        socket.data.user = user || null;

        socket.to(room).emit('presence:join', {
          channelId,
          user: user ? { id: user.id, username: user.username } : null,
          at: new Date().toISOString(),
        });

        socket.emit('chat:joined', { channelId });
      } catch (e) {
        console.error('chat:join error', e);
      }
    });


    socket.on('chat:leave', ({ channelId }) => {
      try {
        const room = `channel:${String(channelId)}`;
        socket.leave(room);
        socket.to(room).emit('presence:leave', {
          channelId,
          user: socket.data.user ? { id: socket.data.user.id, username: socket.data.user.username } : null,
          at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('chat:leave error', e);
      }
    });

    socket.on('disconnecting', () => {
      for (const r of socket.rooms) {
        if (r.startsWith('channel:')) {
          socket.to(r).emit('presence:leave', {
            channelId: r.replace('channel:', ''),
            user: socket.data.user ? { id: socket.data.user.id, username: socket.data.user.username } : null,
            at: new Date().toISOString(),
          });
        }
      }
    });

    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });


  app.post('/api/users/:id/avatar-data', async (req, res) => {
    try {
      const { ObjectId } = require('mongodb');
      const id = String(req.params.id || '');

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'invalid_user_id' });
      }

      const dataUrl = req.body?.dataUrl;
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'invalid_data_url' });
      }
      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { avatarUrl: dataUrl } }
      );

      if (!result.matchedCount) {
        return res.status(404).json({ error: 'user_not_found' });
      }


      io.emit('users:update');
      return res.json({ avatarUrl: dataUrl });
    } catch (err) {
      console.error('avatar-data error', err);
      return res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/groups', async (req, res) => {
  try {
    const { name, ownerId, adminIds = [], memberIds = [] } = req.body || {};
    const owner = asId(ownerId);
    if (!isNonEmptyString(name) || !owner) {
      return res.status(400).json({ error: 'name_and_ownerId_required' });
    }

    const membersSet = new Set([owner, ...memberIds.map(asId).filter(Boolean)].map(String));

    const doc = {
      name: name.trim(),
      ownerId: owner,
      adminIds: adminIds.map(asId).filter(Boolean),
      memberIds: Array.from(membersSet).map(asId),
      promoteRequests: [],
      createdAt: new Date(),
    };

    const result = await groups.insertOne(doc);
    await users.updateOne({ _id: owner }, { $addToSet: { groups: result.insertedId } });

    io.emit('users:update');
    io.emit('groups:update');

    const idStr = result.insertedId.toHexString();
    return res.status(201).json({ ...doc, id: idStr, _id: idStr });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ error: 'group_name_taken' });
    console.error('POST /api/groups error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

  app.post('/api/channels/:channelId/bans', async (req, res) => {
    try {
      const cId = asId(String(req.params.channelId || ''));
      const uId = asId(String(req.body.userId || ''));
      const bannedBy = asId(String(req.body.bannedBy || ''));
      const reason = (req.body.reason || '').trim();
      if (!cId || !uId || !bannedBy || !reason) {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      const [ch, grp, target, actor] = await Promise.all([
        channels.findOne({ _id: cId }, { projection: { name: 1, groupId: 1 } }),
        channels.findOne({ _id: cId }).then(ch => ch ? groups.findOne({ _id: ch.groupId }, { projection: { name: 1 } }) : null),
        users.findOne({ _id: uId }, { projection: { username: 1 } }),
        users.findOne({ _id: bannedBy }, { projection: { username: 1, role: 1 } }),
      ]);
      if (!ch) return res.status(404).json({ error: 'channel_not_found' });
      if (!grp) return res.status(404).json({ error: 'group_not_found' });
      if (!target) return res.status(404).json({ error: 'target_not_found' });
      if (!actor) return res.status(404).json({ error: 'actor_not_found' });

      const targetRole = (target.role || '').toUpperCase?.() || '';
      const actorRole = (actor.role || '').toUpperCase?.() || '';
      if (String(uId) === String(bannedBy)) return res.status(403).json({ error: 'cannot_ban_self' });
      if (targetRole === 'SUPER_ADMIN') return res.status(403).json({ error: 'cannot_ban_super_admin' });
      if (targetRole === 'GROUP_ADMIN' && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'only_super_can_ban_group_admin' });
      }

      await bans.updateOne(
        { channelId: cId, userId: uId },
        {
          $set: {
            channelId: cId,
            channelName: ch.name,
            groupId: ch.groupId,
            groupName: grp.name,
            userId: uId,
            username: target.username,
            bannedBy,
            bannedByName: actor.username,
            reason,
            createdAt: new Date(),
          }
        },
        { upsert: true }
      );

      await channels.updateOne({ _id: cId }, { $pull: { memberIds: { $in: [uId, toHex(uId)] } } }).catch(() => { });
      await ejectUserFromChannel(io, cId, uId);

      io.emit('channels:update');
      return res.json({ ok: true });
    } catch (e) {
      if (e.code === 11000) return res.json({ ok: true });
      console.error('POST ban failed', e);
      return res.status(500).json({ error: 'server_error' });
    }
  });


  async function ensurePromoteRequestsArray(db) {
    const groups = db.collection('groups');

    const r1 = await groups.updateMany(
      { promoteRequests: { $exists: false } },
      { $set: { promoteRequests: [] } }
    );

    const r2 = await groups.updateMany(
      { promoteRequests: { $exists: true, $not: { $type: 'array' } } },
      { $set: { promoteRequests: [] } }
    );
  }

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return res.status(400).json({ error: 'missing_credentials' });
      }

      const user = await users.findOne({ username });

      if (!user) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      res.json({
        token: `session_${user._id.toString()}`,
        user,
      });
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'server error' });
    }
  });

  async function ejectUserFromChannel(io, channelId, userId) {
    const room = `channel:${toHex(channelId)}`;
    for (const [sid, socket] of io.sockets.sockets) {
      const sUserId = socket?.data?.user?.id ? String(socket.data.user.id) : null;
      if (!sUserId) continue;
      if (sUserId === toHex(userId) && socket.rooms.has(room)) {
        socket.leave(room);
        socket.to(room).emit('presence:leave', {
          channelId: toHex(channelId),
          user: socket.data.user,
          at: new Date().toISOString(),
        });
      }
    }
  }


  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: db.databaseName, ts: Date.now() });
  });

  app.get('/api/users', async (_req, res) => {
    try {
      const list = await users.find({}).toArray();
      const out = list.map(u => ({
        ...u,
        id: u._id?.toHexString ? u._id.toHexString() : String(u._id),
        _id: u._id?.toHexString ? u._id.toHexString() : String(u._id),
      }));
      return res.json(out);
    } catch (e) {
      console.error('GET /api/users error:', e);
      return res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { username, email, password = '123', role = 'USER', groups: groupIds = [] } = req.body;
      if (!isNonEmptyString(username) || !isNonEmptyString(email)) {
        return res.status(400).json({ error: 'missing_username_or_email' });
      }

      const doc = {
        username: username.trim(),
        email: email.trim(),
        password,
        role,
        groups: groupIds.map(asId).filter(Boolean),
        createdAt: new Date(),
      };

      const result = await users.insertOne(doc);
      const idStr = result.insertedId.toHexString();

      const newUserId = result.insertedId;

      const general = await groups.findOne({ name: { $regex: /^general$/i } });
      if (general) {
        await groups.updateOne(
          { _id: general._id },
          { $addToSet: { memberIds: newUserId } }
        );

        await users.updateOne(
          { _id: newUserId },
          { $addToSet: { groups: general._id } }
        );
      }

      io.emit('users:update');
      return res.status(201).json({
        ...doc,
        id: idStr,
        _id: idStr,
      });
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ error: 'username_or_email_taken' });
      }
      console.error('POST /api/users error:', e);
      return res.status(500).json({ error: 'server_error' });
    }
  });


  app.get('/api/admin/ban-reports', async (_req, res) => {
    try {
      const rows = await bans.aggregate([
        { $lookup: { from: 'channels', localField: 'channelId', foreignField: '_id', as: 'ch' } },
        { $unwind: { path: '$ch', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'groups', localField: 'ch.groupId', foreignField: '_id', as: 'grp' } },
        { $unwind: { path: '$grp', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'target' } },
        { $unwind: { path: '$target', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'bannedBy', foreignField: '_id', as: 'actor' } },
        { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            groupId: { $ifNull: ['$groupId', '$grp._id'] },
            groupName: { $ifNull: ['$groupName', '$grp.name'] },
            channelId: '$channelId',
            channelName: { $ifNull: ['$channelName', '$ch.name'] },
            userId: '$userId',
            username: { $ifNull: ['$username', '$target.username'] },
            bannedBy: '$bannedBy',
            bannedByName: { $ifNull: ['$bannedByName', '$actor.username'] },
            reason: 1,
            createdAt: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ]).toArray();

      res.json(rows);
    } catch (e) {
      console.error('GET /api/admin/ban-reports failed', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const raw = String(req.params.id || '');
    const isHex = /^[0-9a-fA-F]{24}$/.test(raw);
    const oid = isHex ? new ObjectId(raw) : null;

    const { role, email, username } = req.body || {};
    const update = {};
    if (role) update.role = String(role).toUpperCase();
    if (email) update.email = String(email).trim().toLowerCase();
    if (username) update.username = String(username).trim();
    if (!Object.keys(update).length) return res.status(400).json({ error: 'no_fields_to_update' });

    let matched = 0;
    if (oid) {
      const r1 = await users.updateOne({ _id: oid }, { $set: update });
      matched = r1.matchedCount;
    }

    if (!matched) {
      const r2 = await users.updateOne({ _id: raw }, { $set: update });
      matched = r2.matchedCount;
    }

    if (!matched) return res.status(404).json({ error: 'user_not_found' });

    const u = await users.findOne({
      $or: [
        ...(oid ? [{ _id: oid }, { $expr: { $eq: [{ $toString: '$_id' }, raw] } }] : []),
        { _id: raw },
      ],
    });
    if (!u) return res.status(404).json({ error: 'user_not_found' });

    const idStr = u._id?.toHexString ? u._id.toHexString() : String(u._id);
    return res.json({ ...u, id: idStr, _id: idStr });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ error: 'username_or_email_taken' });
    console.error('PATCH /api/users error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});


  app.delete('/api/users/:id', async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_userId' });
    await users.deleteOne({ _id: id });
    res.json({ ok: true });
  });


  app.get('/api/users/:userId/groups', async (req, res) => {
    try {
      const uId = asId(String(req.params.userId || ''));
      if (!uId) return res.status(400).json({ error: 'invalid_userId' });
      const uHex = uId.toHexString();

      const uDoc = await users.findOne({ _id: uId }, { projection: { groups: 1 } });
      const userGroupHex = (uDoc?.groups || [])
        .map(g => (g?.toHexString ? g.toHexString() : String(g)))
        .filter(Boolean);

      const list = await groups.aggregate([
        {
          $addFields: {
            _ownerHex: { $toString: "$ownerId" },
            _createdByHex: { $toString: "$createdBy" },
            _adminHex: {
              $map: {
                input: { $ifNull: ["$adminIds", []] },
                as: "a",
                in: { $toString: "$$a" }
              }
            },
            _memberHex: {
              $map: {
                input: { $ifNull: ["$memberIds", []] },
                as: "m",
                in: { $toString: "$$m" }
              }
            },
            _idHex: { $toString: "$_id" }
          }
        },
        {
          $match: {
            $or: [
              { _ownerHex: uHex },
              { _createdByHex: uHex },
              { _adminHex: uHex },
              { _memberHex: uHex },
              { _idHex: { $in: userGroupHex } },
            ]
          }
        }
      ]).toArray();

      const seen = new Set();
      const deduped = list.filter(g => {
        const id = g._id?.toHexString?.() ?? String(g._id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      res.json(deduped);
    } catch (e) {
      console.error('GET /api/users/:userId/groups failed', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.get('/api/groups', async (_req, res) => {
    try {
      const list = await groups.find().toArray();
       const out = list.map(g => {
      const idStr = g._id?.toHexString ? g._id.toHexString() : String(g._id);
      return { ...g, id: idStr, _id: idStr };
    });
      return res.json(out);
    } catch (e) {
      console.error('GET /api/groups error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.post('/api/admin/fix/supers-in-groups', async (_req, res) => {
    try {
      const supers = await users.find({ role: 'SUPER_ADMIN' }, { projection: { _id: 1 } }).toArray();
      const superHex = supers.map(u => u._id.toHexString());

      const r = await groups.updateMany(
        {},
        [
          { $set: { memberIds: { $setUnion: ["$memberIds", superHex] } } }
        ]
      );

      io.emit('groups:update');
      res.json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
    } catch (e) {
      console.error('fix supers-in-groups error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });
app.patch('/api/groups/:groupId', async (req, res) => {
  console.log('PATCH /api/groups/:groupId called', req.params, req.body);
  try {
    const { ObjectId } = require('mongodb');
    const raw = String(req.params.groupId || '');
    const isHex = /^[0-9a-fA-F]{24}$/.test(raw);
    const oid = isHex ? new ObjectId(raw) : null;

    const { name } = req.body || {};
    if (!isNonEmptyString(name)) return res.status(400).json({ error: 'invalid_input' });
    const trimmedName = name.trim();

    const clash = await groups.findOne({
      name: trimmedName,
      $nor: [
        ...(oid ? [{ _id: oid }, { $expr: { $eq: [{ $toString: '$_id' }, raw] } }] : []),
        { _id: raw },
      ],
    });
    if (clash) return res.status(409).json({ error: 'group_name_taken' });

    let matched = 0;
    if (oid) {
      const r1 = await groups.updateOne({ _id: oid }, { $set: { name: trimmedName } });
      matched = r1.matchedCount;
    }

    if (!matched) {
      const r2 = await groups.updateOne({ _id: raw }, { $set: { name: trimmedName } });
      matched = r2.matchedCount;
    }

    if (!matched) return res.status(404).json({ error: 'group_not_found' });

    const doc = await groups.findOne({
      $or: [
        ...(oid ? [{ _id: oid }, { $expr: { $eq: [{ $toString: '$_id' }, raw] } }] : []),
        { _id: raw },
      ],
    });
    if (!doc) return res.status(404).json({ error: 'group_not_found' });

    io.emit('groups:update');
    return res.json(doc);
  } catch (err) {
    console.error('Rename group error:', err);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
});


  app.delete('/api/groups/:groupId', async (req, res) => {
    const gId = asId(req.params.groupId);
    if (!gId) return res.status(400).json({ error: 'invalid_group_Id' });
    await groups.deleteOne({ _id: gId });
    await channels.deleteMany({ groupId: gId });
    await messages.deleteMany({ groupId: gId });
    io.emit('groups:update');
    io.emit('users:update');
    res.json({ ok: true });
  });

  app.post('/api/groups/:groupId/members', async (req, res) => {
    try {
      const gId = asId(String(req.params.groupId || ''));
      const uId = asId(String(req.body.userId || ''));
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });

      const [user, group] = await Promise.all([
        users.findOne({ _id: uId }),
        groups.findOne({ _id: gId }),
      ]);
      if (!user) return res.status(404).json({ error: 'user_not_found' });
      if (!group) return res.status(404).json({ error: 'group_not_found' });


      await Promise.all([
        groups.updateOne({ _id: gId }, { $addToSet: { memberIds: uId } }),
        users.updateOne({ _id: uId }, { $addToSet: { groups: gId } }),
        channels.updateMany({ groupId: gId }, { $addToSet: { memberIds: uId } }),

      ]);

      const updated = await groups.findOne({ _id: gId });
      io.emit('groups:update');
      io.emit('users:update');
      io.emit('channels:update');
      res.json(updated);
    } catch (e) {
      console.error('Add member error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.get('/api/groups/:groupId/promotable', async (req, res) => {
    try {
      const gId = asId(String(req.params.groupId || ''));
      if (!gId) return res.status(400).json({ error: 'invalid_groupId' });

      const g = await groups.findOne({ _id: gId }, { projection: { ownerId: 1, adminIds: 1, memberIds: 1 } });
      if (!g) return res.status(404).json({ error: 'group_not_found' });

      const ownerHex = g.ownerId?.toHexString?.() ?? String(g.ownerId);
      const adminHex = new Set((g.adminIds || []).map(x => x.toHexString?.() ?? String(x)));
      const memberIds = (g.memberIds || []).filter(Boolean);

      const members = await users.find(
        { _id: { $in: memberIds }, role: { $ne: 'SUPER_ADMIN' } },
        { projection: { _id: 1, username: 1, role: 1, email: 1 } }
      ).toArray();

      const promotable = members
        .filter(u => {
          const uid = u._id.toHexString?.() ?? String(u._id);
          return uid !== ownerHex && !adminHex.has(uid);
        })
        .map(u => ({ _id: u._id, username: u.username, role: u.role, email: u.email }));

      res.json(promotable);
    } catch (e) {
      console.error('GET promotable error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/admin/fix/owner-membership', async (_req, res) => {
    try {

      const r1 = await groups.updateMany(
        {},
        [
          {
            $set: {
              memberIds: {
                $setUnion: [
                  {
                    $map: {
                      input: "$memberIds",
                      as: "m",
                      in: { $toString: "$$m" }
                    }
                  },
                  [
                    { $toString: "$ownerId" },
                    { $toString: "$createdBy" }
                  ]
                ]
              }
            }
          }
        ]
      );

      const all = await groups.find({}, { projection: { _id: 1, ownerId: 1, createdBy: 1 } }).toArray();
      const ops = all
        .map(g => {
          const owner = g.ownerId ?? g.createdBy;
          if (!owner) return null;
          return {
            updateOne: {
              filter: { _id: owner },
              update: { $addToSet: { groups: g._id } }
            }
          };
        })
        .filter(Boolean);

      if (ops.length) await users.bulkWrite(ops);

      io.emit('groups:update');
      io.emit('users:update');
      res.json({ ok: true, updatedGroups: r1.modifiedCount, ownerLinksAdded: ops.length });
    } catch (e) {
      console.error('owner membership fix failed', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.delete('/api/groups/:groupId/members/:userId', async (req, res) => {
    try {
      const gId = asId(String(req.params.groupId || ''));
      const uId = asId(String(req.params.userId || ''));
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });

      const g = await groups.findOne({ _id: gId });
      if (!g) return res.status(404).json({ error: 'group_not_found' });


      const isGeneral = (g.name || '').toLowerCase() === 'general';
      if (isGeneral) return res.status(400).json({ error: 'cannot_leave_general' });

      const ownerId = String(g.ownerId || g.createdBy || '');
      if (String(uId) === ownerId || uId.toHexString?.() === ownerId) {
        return res.status(400).json({ error: 'cannot_remove_owner' });
      }


      const uHex = uId.toHexString();
      const gHex = gId.toHexString();

      await Promise.all([

        groups.updateOne(
          { _id: gId },
          {
            $pull: {
              memberIds: { $in: [uId, uHex] },
              adminIds: { $in: [uId, uHex] },
            },
          }
        ),

        users.updateOne(
          { _id: uId },
          { $pull: { groups: { $in: [gId, gHex] } } }
        ),

        channels.updateMany(
          { groupId: { $in: [gId, gHex] } },
          { $pull: { memberIds: { $in: [uId, uHex] } } }
        ),
      ]);

      io.emit('groups:update');
      io.emit('users:update');
      io.emit('channels:update');
      res.json({ ok: true });
    } catch (e) {
      console.error('Remove member error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });



  app.post('/api/groups/:groupId/admins', async (req, res) => {
    const gId = asId(req.params.groupId);
    const uId = asId(req.body.userId);
    if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });
    await groups.updateOne({ _id: gId }, { $addToSet: { adminIds: uId } });
    res.json({ ok: true });
  });



  app.get('/api/groups/:groupId/channels', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      if (!gId) return res.status(400).json({ error: 'invalid_groupId' });

      const list = await channels.find({ groupId: gId }).toArray();
      res.json(list);
    } catch (e) {
      console.error('Error fetching channels for group:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.post('/api/groups/:groupId/channels', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      const { name, isGlobal = false } = req.body || {};
      if (!gId) return res.status(400).json({ error: 'invalid_groupId' });
      if (!isNonEmptyString(name)) return res.status(400).json({ error: 'name_required' });

      const grp = await groups.findOne({ _id: gId });
      if (!grp) return res.status(404).json({ error: 'group_not_found' });


      const exists = await channels.findOne({ groupId: gId, name: name.trim() });
      if (exists) return res.status(409).json({ error: 'channel_exists_in_group' });

      const doc = {
        groupId: gId,
        name: name.trim(),
        isGlobal: !!isGlobal,
        createdAt: new Date(),
      };

      const { insertedId } = await channels.insertOne(doc);
      io.emit('channels:update');
      res.status(201).json({ ...doc, _id: insertedId });
    } catch (e) {
      console.error('Create channel (group) error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.post('/api/groups/:groupId/promotion-requests', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      const targetUserId = asId(req.body.userId);

      const requestedBy = asId(req.body.requestedBy);

      if (!gId || !targetUserId || !requestedBy) {
        return res.status(400).json({ error: 'invalid_ids' });
      }

      const g = await groups.findOne(
        { _id: gId },
        { projection: { ownerId: 1, adminIds: 1, memberIds: 1, promoteRequests: 1 } }
      );
      if (!g) return res.status(404).json({ error: 'group_not_found' });


      const requester = await users.findOne({ _id: requestedBy }, { projection: { role: 1 } });
      const requesterIsAdmin =
        requester?.role === 'SUPER_ADMIN' ||
        String(g.ownerId || '') === String(requestedBy) ||
        (g.adminIds || []).some(x => String(x) === String(requestedBy));
      if (!requesterIsAdmin) return res.status(403).json({ error: 'requester_not_admin' });

      const isMember = (g.memberIds || []).some(x => String(x) === String(targetUserId));
      const isAdmin = (g.adminIds || []).some(x => String(x) === String(targetUserId));
      if (!isMember) return res.status(403).json({ error: 'not_a_member' });
      if (isAdmin) return res.status(409).json({ error: 'already_admin' });


      if (!Array.isArray(g.promoteRequests)) {
        await groups.updateOne({ _id: gId }, { $set: { promoteRequests: [] } });
      }

      await groups.updateOne(
        { _id: gId },
        { $addToSet: { promoteRequests: targetUserId } }
      );

      io.emit('groups:update');
      res.json({ ok: true, message: 'Promotion request submitted' });
    } catch (e) {
      console.error('request group promotion error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });



  app.get('/api/groups/:groupId/promotion-requests', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      if (!gId) return res.status(400).json({ error: 'invalid_groupId' });

      const g = await groups.findOne(
        { _id: gId },
        { projection: { promoteRequests: 1 } }
      );
      if (!g) return res.status(404).json({ error: 'group_not_found' });

      const list = Array.isArray(g.promoteRequests) ? g.promoteRequests : [];
      const requests = list.map(v => (v?.toHexString ? v.toHexString() : String(v)));
      res.json({ requests });
    } catch (e) {
      console.error('list group promotion requests error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.post('/api/groups/:groupId/promotion-requests/:userId/approve', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      const uId = asId(req.params.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });


      await groups.updateOne(
        { _id: gId },
        {
          $pull: { promoteRequests: uId },
          $addToSet: { adminIds: uId, memberIds: uId },
        }
      );
      await users.updateOne({ _id: uId }, { $set: { role: 'GROUP_ADMIN', promotionRequested: false } });

      io.emit('groups:update');
      io.emit('users:update');
      res.json({ ok: true });
    } catch (e) {
      console.error('approve promotion error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });


  app.post('/api/groups/:groupId/promotion-requests/:userId/reject', async (req, res) => {
    try {
      const gId = asId(req.params.groupId);
      const uId = asId(req.params.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });

      await groups.updateOne({ _id: gId }, { $pull: { promoteRequests: uId } });
      await users.updateOne({ _id: uId }, { $set: { promotionRequested: false } });

      io.emit('groups:update');
      io.emit('users:update');
      res.json({ ok: true });
    } catch (e) {
      console.error('reject promotion error:', e);
      res.status(500).json({ error: 'server_error' });
    }
  });



  app.post('/api/users/:userId/request-promotion', async (req, res) => {
    try {
      const uId = asId(req.params.userId);
      if (!uId) return res.status(400).json({ error: 'invalid_userId' });

      const r = await users.updateOne({ _id: uId }, { $set: { promotionRequested: true } });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'user_not_found' });

      io.emit('users:update');
      res.json({ ok: true, message: 'Promotion request submitted' });
    } catch (err) {
      console.error('Request promotion error:', err);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/users/:userId/promote', async (req, res) => {
    try {
      const uId = asId(req.params.userId);
      if (!uId) return res.status(400).json({ error: 'invalid_userId' });

      const role = req.body?.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'GROUP_ADMIN';
      const r = await users.updateOne({ _id: uId }, { $set: { role, promotionRequested: false } });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'user_not_found' });

      io.emit('users:update');
      res.json({ ok: true, message: `User promoted to ${role}` });
    } catch (err) {
      console.error('Promote user error:', err);
      res.status(500).json({ error: 'server_error' });
    }
  });



  app.post('/api/users/:userId/super', async (req, res) => {
    try {
      const uId = asId(req.params.userId);
      if (!uId) return res.status(400).json({ error: 'invalid_userId' });

      const user = await users.findOne({ _id: uId });
      if (!user) return res.status(404).json({ error: 'user_not_found' });

      await users.updateOne({ _id: uId }, { $set: { role: 'SUPER_ADMIN' } });
      io.emit('users:update');
      res.json({ ok: true, message: 'User upgraded to SUPER_ADMIN' });
    } catch (err) {
      console.error('Super promotion error:', err);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.get('/api/channels', async (_req, res) => {
    res.json(await channels.find().toArray());
  });

  app.post('/api/channels', async (req, res) => {
    try {
      const { groupId, name, isGlobal = false } = req.body;
      const gId = asId(groupId);
      if (!gId || !isNonEmptyString(name))
        return res.status(400).json({ error: 'groupId_and_name_required' });

      const doc = {
        groupId: gId,
        name: name.trim(),
        isGlobal: !!isGlobal,
        createdAt: new Date(),
      };
      const result = await channels.insertOne(doc);
      io.emit('channels:update');
      res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'channel_exists_in_group' });
      console.error(e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.delete('/api/channels/:id', async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_channelId' });
    await channels.deleteOne({ _id: id });
    await messages.deleteMany({ channelId: id });
    io.emit('channels:update');
    res.json({ ok: true });
  });


  app.get('/api/channels/:channelId/messages', async (req, res) => {
    try {
      const channelId = asId(req.params.channelId);
      if (!channelId) return res.status(400).json({ error: 'invalid_channelId' });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const before = req.query.before ? new Date(req.query.before) : null;


      const query = { channelId };
      if (before && !isNaN(before.getTime())) {
        query.createdAt = { $lt: before };
      }

      const list = await messages
        .find(query)
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();

      res.json(list);
    } catch (e) {
      console.error('GET messages error', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.post('/api/channels/:channelId/messages', async (req, res) => {
    try {
      const channelId = asId(req.params.channelId);
      const senderId = asId(req.body.userId);
      const username = (req.body.username || '').trim();
      const body = (req.body.text || req.body.body || '').trim();
      const imageUrl = (req.body.imageDataUrl || '').trim();

      if (!channelId || !senderId || (!body && !imageUrl)) {
        return res.status(400).json({ error: 'invalid_payload' });
      }

      const banned = await bans.findOne({ channelId, userId: senderId });
      if (banned) return res.status(403).json({ error: 'banned_from_channel' });

      const sender = await users.findOne(
        { _id: senderId },
        { projection: { username: 1, avatarUrl: 1 } }
      );

      const doc = {
        channelId,
        senderId,
        username: username || sender?.username || undefined,
        avatarUrl: sender?.avatarUrl || undefined,
        body: body || undefined,
        imageUrl: imageUrl || undefined,
        createdAt: new Date(),
      };

      const result = await messages.insertOne(doc);
      const saved = { ...doc, _id: result.insertedId };

      const room = `channel:${toHex(channelId)}`;

      io.to(room).emit('chat:message', {
        _id: saved._id,
        channelId: toHex(saved.channelId),
        senderId: toHex(saved.senderId),
        username: saved.username,
        avatarUrl: saved.avatarUrl,
        body: saved.body,
        imageUrl: saved.imageUrl,
        createdAt: saved.createdAt,
      });

      io.to(room).emit(`messages:update:${toHex(channelId)}`);

      return res.status(201).json(saved);
    } catch (e) {
      console.error('POST /api/channels/:channelId/messages failed', e);
      return res.status(500).json({ error: 'server_error' });
    }
  });

  app.get('/api/channels/:channelId/bans', async (req, res) => {
    try {
      const raw = String(req.params.channelId || '');
      const cId = asId(raw);
      if (!cId) return res.status(400).json({ error: 'invalid_channelId' });

      const list = await bans
        .find({ channelId: { $in: [cId, cId.toHexString()] } })
        .project({ userId: 1, reason: 1, bannedBy: 1, createdAt: 1 })
        .toArray();

      const toHex = (x) => (x?.toHexString?.() ?? String(x ?? ''));
      const out = list.map(b => ({
        userId: toHex(b.userId),
        reason: b.reason || '',
        bannedBy: toHex(b.bannedBy),
        createdAt: b.createdAt || null,
      }));

      res.set('Cache-Control', 'no-cache');
      res.json(out);
    } catch (e) {
      console.error('GET bans failed', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  app.delete('/api/channels/:channelId/bans/:userId', async (req, res) => {
    try {
      const cId = asId(String(req.params.channelId || ''));
      const uId = asId(String(req.params.userId || ''));
      if (!cId || !uId) return res.status(400).json({ error: 'invalid_ids' });

      await bans.deleteOne({ channelId: cId, userId: uId });

      io.emit('channels:update');
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE ban failed', e);
      res.status(500).json({ error: 'server_error' });
    }
  });

  return { app, server, io, db };
}

const port = Number(process.env.PORT) || 3000;

async function start() {
  const { server } = await buildServer();
  server.listen(port, () => {
    console.log(`Socket.IO running on http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
}

module.exports = { buildServer };