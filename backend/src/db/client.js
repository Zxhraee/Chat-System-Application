require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

let client;
let db;

async function getDb() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });
  }

  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
    console.log('Connected to MongoDB');
  }

  db = client.db(dbName);
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    console.log('MongoDB connection has closed');
  }
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

module.exports = { getDb };
