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
  console.log('Connected to MongoDB');
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
    await coll.dropIndex(byKey.name).catch(() => {});
  }

  if (options.name) {
    const nameClash = indexes.find(ix => ix.name === options.name && !sameKey(ix.key, keys));
    if (nameClash) await coll.dropIndex(nameClash.name).catch(() => {});
  }

  await coll.createIndex(keys, options);
}

async function ensureCollections(db) {
  const existingNames = new Set((await db.listCollections().toArray()).map(c => c.name));

  async function withSchema(name, validator) {
    if (!existingNames.has(name)) {
      await db.createCollection(name, { validator: { $jsonSchema: validator } });
    } else {
      await db.command({ collMod: name, validator: { $jsonSchema: validator } }).catch(() => {});
    }
    return db.collection(name);
  }

  const users = await withSchema('users', {
    bsonType: 'object',
    required: ['username', 'email', 'password', 'role', 'createdAt'],
    properties: {
      username: { bsonType: 'string' },
      email: { bsonType: 'string' },
      password: { bsonType: 'string' },
      role: { enum: ['SUPER_ADMIN', 'GROUP_ADMIN', 'USER'] },
      groups: { bsonType: ['array'], items: { bsonType: 'objectId' } },
      createdAt: { bsonType: 'string' }
    },
    additionalProperties: true
  });

  const groups = await withSchema('groups', {
    bsonType: 'object',
    required: ['name', 'ownerId', 'adminIds', 'memberIds', 'createdAt'],
    properties: {
      name: { bsonType: 'string' },
      ownerId: { bsonType: 'objectId' },
      adminIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
      memberIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
      createdAt: { bsonType: 'string' }
    },
    additionalProperties: true
  });

  const channels = await withSchema('channels', {
    bsonType: 'object',
    required: ['groupId', 'name', 'isGlobal', 'createdAt'],
    properties: {
      groupId: { bsonType: 'objectId' },
      name: { bsonType: 'string' },
      isGlobal: { bsonType: 'bool' },
      createdAt: { bsonType: 'string' }
    },
    additionalProperties: true
  });

  const messages = await withSchema('messages', {
    bsonType: 'object',
    required: ['channelId', 'senderId', 'content', 'createdAt'],
    properties: {
      channelId: { bsonType: 'objectId' },
      senderId: { bsonType: 'objectId' },
      content: { bsonType: 'string' },
      createdAt: { bsonType: 'string' }
    },
    additionalProperties: true
  });

  await ensureIndex(users,    { username: 1 },                 { unique: true, name: 'users_username_unique' });
  await ensureIndex(users,    { email: 1 },                    { unique: true, name: 'users_email_unique' });
  await ensureIndex(groups,   { name: 1 },                     { unique: true, name: 'groups_name_unique' });
  await ensureIndex(channels, { groupId: 1, name: 1 },         { unique: true, name: 'channels_group_name_unique' });
  await ensureIndex(messages, { channelId: 1, createdAt: 1 },  { name: 'messages_channel_createdAt' });
  await ensureIndex(messages, { senderId: 1 },                 { name: 'messages_sender' });
}

module.exports = {
  connectDB,
  ensureCollections
};
