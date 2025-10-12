const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

before(async function () {
  this.timeout(60000);
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = uri;         
  process.env.MONGODB_DB  = 'chatdb_test'; 
  process.env.SEED_ON_START = 'false';   
});

after(async () => {
  if (mongod) await mongod.stop();
});
