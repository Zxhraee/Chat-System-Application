require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'chatdb';
const port = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

let db, users, groups, channels, messages;

async function start() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');

    db = client.db(dbName);
    users = db.collection('users');
    groups = db.collection('groups');
    channels = db.collection('channels');
    messages = db.collection('messages');

    app.get('/api/health', (_req, res) => {
      res.json({ ok: true, db: dbName, ts: Date.now() });
    });

    app.get('/api/users', async (_req, res) => {
      const list = await users.find().toArray();
      res.json(list);
    });

    app.post('/api/users', async (req, res) => {
      const user = req.body;
      const result = await users.insertOne(user);
      res.status(201).json({ ...user, _id: result.insertedId });
    });

    app.get('/api/groups', async (_req, res) => {
      const list = await groups.find().toArray();
      res.json(list);
    });

    app.post('/api/groups', async (req, res) => {
      const group = req.body; 
      const result = await groups.insertOne(group);
      res.status(201).json({ ...group, _id: result.insertedId });
    });

    app.get('/api/channels', async (_req, res) => {
      const list = await channels.find().toArray();
      res.json(list);
    });

    app.post('/api/channels', async (req, res) => {
      const channel = req.body; 
      const result = await channels.insertOne(channel);
      res.status(201).json({ ...channel, _id: result.insertedId });
    });

    app.get('/api/channels/:channelId/messages', async (req, res) => {
      const list = await messages
        .find({ channelId: req.params.channelId })
        .sort({ timestamp: 1 })
        .toArray();
      res.json(list);
    });

    app.post('/api/channels/:channelId/messages', async (req, res) => {
      const msg = {
        channelId: req.params.channelId,
        userId: req.body.userId,
        username: req.body.username,
        text: (req.body.text || '').trim(),
        timestamp: Date.now(),
      };
      if (!msg.text) return res.status(400).json({ error: 'Empty message' });
      const result = await messages.insertOne(msg);
      res.status(201).json({ ...msg, _id: result.insertedId });
    });

    app.listen(port, () =>
      console.log(`Chat backend running on http://localhost:${port}`)
    );
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

start();
