//Load Env file 
require('dotenv').config();

//Import MongoClient class and retrieve MongoDB information from Env file
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
let client;
let db;

//Function returning DB handle
async function getDb() {
  //Reuse existing db handle
  if (db) return db;
  //Create Mongoclient
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });
  }

  //Intiliase client connect
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
    console.log('Connected to MongoDB');
  }

  //DB name handle 
  db = client.db(dbName);
  return db;
}

//Close connection
async function closeDb() {
  if (client) {
    await client.close();
    console.log('MongoDB connection has closed');
  }
}

//Close MongoDB before exiting
process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

//Export getDB function
module.exports = { getDb };
