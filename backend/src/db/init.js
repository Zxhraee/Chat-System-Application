//Load variables from env file
require('dotenv').config();
//MongoDB imports
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'chatdb';

let _client;

//Return DB for connected client
async function connectDB() {
  if (_client && _client.topology && _client.topology.isConnected()) {
    return _client.db(dbName);
  }
  //Otherwise construct new client
  _client = new MongoClient(uri, { ignoreUndefined: true });
  await _client.connect();
  console.log('Connected to MongoDB:', uri, 'db=', dbName);
  return _client.db(dbName);
}

//Compare index key objects
function sameKey(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

//Create or repair DB index
async function ensureIndex(coll, keys, options = {}) {
  //Fetch array of all existing index and check for index with matching keys
  const indexes = await coll.indexes();
  const byKey = indexes.find(ix => sameKey(ix.key, keys));
  //if index with same key exists and its unique, do nothing
  if (byKey && (!!byKey.unique) === !!options.unique) return;
  //if index with same key exists but unique flag doesn't match, drop 
  if (byKey) {
    await coll.dropIndex(byKey.name).catch(() => { });
  }
  //if index name already exists with different key, drop index
  if (options.name) {
    const clash = indexes.find(ix => ix.name === options.name && !sameKey(ix.key, keys));
    if (clash) await coll.dropIndex(clash.name).catch(() => { });
  }
  //create index
  await coll.createIndex(keys, options);
}

//collections function
async function ensureCollections(db) {
  //List db collection and return set of all collection name
  const existing = new Set((await db.listCollections().toArray()).map(c => c.name));
  //Create collections if not existing 
  if (!existing.has('users')) await db.createCollection('users');
  if (!existing.has('groups')) await db.createCollection('groups');
  if (!existing.has('channels')) await db.createCollection('channels');
  if (!existing.has('messages')) await db.createCollection('messages');
  //Relax validation to avoid seeding from blocking writes
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
  //Apply validation relaxation to seeded collections
  await Promise.all(['users', 'groups', 'channels', 'messages'].map(clear));
  //Grab collections
  const users = db.collection('users');
  const groups = db.collection('groups');
  const channels = db.collection('channels');
  const messages = db.collection('messages');

  //Enforce indexes on collections
  await ensureIndex(users, { username: 1 }, { unique: true, name: 'users_username_unique' });
  await ensureIndex(users, { email: 1 }, { unique: true, name: 'users_email_unique' });
  await ensureIndex(groups, { name: 1 }, { unique: true, name: 'groups_name_unique' });
  await ensureIndex(channels, { groupId: 1, name: 1 }, { unique: true, name: 'channels_group_name_unique' });
  await ensureIndex(messages, { channelId: 1, createdAt: 1 }, { name: 'messages_channel_createdAt' });
  await ensureIndex(messages, { senderId: 1 }, { name: 'messages_sender' });
}

//Exports
module.exports = {
  connectDB,
  ensureCollections
};
