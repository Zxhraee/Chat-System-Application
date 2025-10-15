//load fake in memory MongoDB 
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod;

//before test run
before(async function () {
  //start and setup in mem MongoDB server 
  this.timeout(60000);
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = uri;         
  process.env.MONGODB_DB  = 'chatdb_test'; 
  process.env.SEED_ON_START = 'false';   
});

//run after test done - shutdown in memory MongoDB
after(async () => {
  if (mongod) await mongod.stop();
});
