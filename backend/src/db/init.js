require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'chatdb';

let _client;

async function connectDB() {
  if (_client && _client.topology && _client.topology.isConnected()) {
    return _client.db(dbName);
  }
  _client = new MongoClient(uri, { ignoreUndefined: true });
  await _client.connect();
  console.log('✅ Connected to MongoDB:', uri, 'db=', dbName);
  return _client.db(dbName);
}

function sameKey(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function ensureIndex(coll, keys, options = {}) {
  const indexes = await coll.indexes();
  const byKey = indexes.find(ix => sameKey(ix.key, keys));

  if (byKey && (!!byKey.unique) === !!options.unique) return;

  if (byKey) {
    await coll.dropIndex(byKey.name).catch(() => { });
  }
  if (options.name) {
    const clash = indexes.find(ix => ix.name === options.name && !sameKey(ix.key, keys));
    if (clash) await coll.dropIndex(clash.name).catch(() => { });
  }
  await coll.createIndex(keys, options);
}

async function ensureCollections(db) {
  const existing = new Set((await db.listCollections().toArray()).map(c => c.name));

  if (!existing.has('users')) await db.createCollection('users');
  if (!existing.has('groups')) await db.createCollection('groups');
  if (!existing.has('channels')) await db.createCollection('channels');
  if (!existing.has('messages')) await db.createCollection('messages');

  const clear = async (name) => {
    try {
      await db.command({
        collMod: name,
        validator: {},
        validationLevel: 'off',
        validationAction: 'warn'
      });
    } catch (e) {
    }
  };
  await Promise.all(['users', 'groups', 'channels', 'messages'].map(clear));

  const users = db.collection('users');
  const groups = db.collection('groups');
  const channels = db.collection('channels');
  const messages = db.collection('messages');


  await ensureIndex(users, { username: 1 }, { unique: true, name: 'users_username_unique' });
  await ensureIndex(users, { email: 1 }, { unique: true, name: 'users_email_unique' });
  await ensureIndex(groups, { name: 1 }, { unique: true, name: 'groups_name_unique' });
  await ensureIndex(channels, { groupId: 1, name: 1 }, { unique: true, name: 'channels_group_name_unique' });
  await ensureIndex(messages, { channelId: 1, createdAt: 1 }, { name: 'messages_channel_createdAt' });
  await ensureIndex(messages, { senderId: 1 }, { name: 'messages_sender' });
}

module.exports = {
  connectDB,
  ensureCollections
};
