require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, ensureCollections } = require('./db/init');
const { asId, isNonEmptyString } = require('./db/helper');
const http = require('http');
const { Server } = require('socket.io');

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    const app = express();
    app.use(cors({ origin: 'http://localhost:4200' }));
    app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);
  socket.on('disconnect', () => console.log('🔴 Client disconnected:', socket.id));
});


    const db = await connectDB();
    await ensureCollections(db);

    const users = db.collection('users');
    const groups = db.collection('groups');
    const channels = db.collection('channels');
    const messages = db.collection('messages');


    app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
          return res.status(400).json({ error: 'missing_credentials' });
        }

        const user = await users.findOne({ username });
        if (!user || user.password !== password) {
          return res.status(401).json({ error: 'invalid_credentials' });
        }

        res.json({
          token: `session_${user._id.toString()}`,
          user,
        });
      } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'server_error' });
      }
    });


    app.get('/api/health', (_req, res) => {
      res.json({ ok: true, db: db.databaseName, ts: Date.now() });
    });

    app.get('/api/users', async (_req, res) => {
      res.json(await users.find().toArray());
    });

    app.post('/api/users', async (req, res) => {
      try {
        const { username, email, password = '123', role = 'USER', groups: groupIds = [] } = req.body;
        if (!isNonEmptyString(username) || !isNonEmptyString(email)) {
          return res.status(400).json({ error: 'username_and_email_required' });
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
        io.emit('users:update');
        res.status(201).json({ ...doc, _id: result.insertedId });
      } catch (e) {
        if (e.code === 11000) return res.status(409).json({ error: 'username_or_email_taken' });
        console.error(e);
        res.status(500).json({ error: 'server_error' });
      }
    });

    app.patch('/api/users/:id', async (req, res) => {
      const id = asId(req.params.id);
      if (!id) return res.status(400).json({ error: 'invalid_userId' });
      const { role, email, username } = req.body;
      const update = {};
      if (role) update.role = role;
      if (email) update.email = email;
      if (username) update.username = username;

      const result = await users.findOneAndUpdate(
        { _id: id },
        { $set: update },
        { returnDocument: 'after' }
      );
      res.json(result.value);
    });

    app.delete('/api/users/:id', async (req, res) => {
      const id = asId(req.params.id);
      if (!id) return res.status(400).json({ error: 'invalid_userId' });
      await users.deleteOne({ _id: id });
      res.json({ ok: true });
    });

    app.get('/api/groups', async (_req, res) => {
      res.json(await groups.find().toArray());
    });

    app.post('/api/groups', async (req, res) => {
      try {
        const { name, ownerId, adminIds = [], memberIds = [] } = req.body;
        const owner = asId(ownerId);
        if (!isNonEmptyString(name) || !owner) {
          return res.status(400).json({ error: 'name_and_ownerId_required' });
        }

        const doc = {
          name: name.trim(),
          ownerId: owner,
          adminIds: adminIds.map(asId).filter(Boolean),
          memberIds: memberIds.map(asId).filter(Boolean),
          createdAt: new Date(),
        };
        const result = await groups.insertOne(doc);
        io.emit('groups:update');
        res.status(201).json({ ...doc, _id: result.insertedId });
      } catch (e) {
        if (e.code === 11000) return res.status(409).json({ error: 'group_name_taken' });
        console.error(e);
        res.status(500).json({ error: 'server_error' });
      }
    });

   app.patch('/api/groups/:groupId', async (req, res) => {
  console.log('PATCH /api/groups/:groupId called', req.params, req.body);

  try {
    const gId = asId(req.params.groupId);
    const { name } = req.body;

    if (!gId || !isNonEmptyString(name)) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    const trimmedName = name.trim();

    const existing = await groups.findOne({ name: trimmedName });
    if (existing && !existing._id.equals(gId)) {
      return res.status(409).json({ error: 'group_name_taken' });
    }


    const updateResult = await groups.findOneAndUpdate(
      { _id: gId },
      { $set: { name: trimmedName } },
      { returnDocument: 'after' } 
    );


    if (!updateResult.value) {
      console.warn(`❌ No group found for id: ${gId}`);
      return res.status(404).json({ error: 'group_not_found' });
    }

    console.log(`✏️ Group renamed successfully to: ${updateResult.value.name}`);
        io.emit('groups:update'); 
        res.json(updateResult.value);
  } catch (err) {
    console.error('Rename group error:', err);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
});


    app.delete('/api/groups/:groupId', async (req, res) => {
      const gId = asId(req.params.groupId);
      if (!gId) return res.status(400).json({ error: 'invalid_groupId' });
      await groups.deleteOne({ _id: gId });
      await channels.deleteMany({ groupId: gId });
      await messages.deleteMany({ groupId: gId });
      io.emit('groups:update'); 
      res.json({ ok: true });
    });

    app.post('/api/groups/:groupId/members', async (req, res) => {
      const gId = asId(req.params.groupId);
      const uId = asId(req.body.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });
      await groups.updateOne({ _id: gId }, { $addToSet: { memberIds: uId } });
      res.json({ ok: true });
    });

    app.delete('/api/groups/:groupId/members/:userId', async (req, res) => {
      const gId = asId(req.params.groupId);
      const uId = asId(req.params.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });
      await groups.updateOne({ _id: gId }, { $pull: { memberIds: uId } });
      res.json({ ok: true });
    });

    app.post('/api/groups/:groupId/admins', async (req, res) => {
      const gId = asId(req.params.groupId);
      const uId = asId(req.body.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });
      await groups.updateOne({ _id: gId }, { $addToSet: { adminIds: uId } });
      res.json({ ok: true });
    });

    app.delete('/api/groups/:groupId/admins/:userId', async (req, res) => {
      const gId = asId(req.params.groupId);
      const uId = asId(req.params.userId);
      if (!gId || !uId) return res.status(400).json({ error: 'invalid_ids' });
      await groups.updateOne({ _id: gId }, { $pull: { adminIds: uId } });
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
      const channelId = asId(req.params.channelId);
      if (!channelId) return res.status(400).json({ error: 'invalid_channelId' });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const before = req.query.before ? new Date(req.query.before) : null;
      const query = { channelId };
      if (before && !isNaN(before.getTime())) query.createdAt = { $lt: before };

      const list = await messages.find(query).sort({ createdAt: 1 }).limit(limit).toArray();
      res.json(list);
    });

    app.post('/api/channels/:channelId/messages', async (req, res) => {
      try {
        const channelId = asId(req.params.channelId);
        const senderId = asId(req.body.userId);
        const username = (req.body.username || '').trim();
        const body = (req.body.text || req.body.body || '').trim();

        if (!channelId || !senderId || !isNonEmptyString(body))
          return res.status(400).json({ error: 'channelId_senderId_body_required' });

        const doc = {
          channelId,
          senderId,
          username: isNonEmptyString(username) ? username : undefined,
          body,
          meta: req.body.meta || {},
          createdAt: new Date(),
        };

        const result = await messages.insertOne(doc);
        io.emit('messages:update', { channelId });
        res.status(201).json({ ...doc, _id: result.insertedId });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'server_error' });
      }
    });


  server.listen(port, () => {
  console.log(`✅ Chat backend (Socket.IO) running on http://localhost:${port}`);
});

  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

start();