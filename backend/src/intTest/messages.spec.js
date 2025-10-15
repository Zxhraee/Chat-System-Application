//load supertest and chai
const request = require('supertest');
const { expect } = require('chai');

//start Messages API test
describe('Messages API', function () {
  let app;
  let userId;
  let groupId;
  let channelId;

  //before test
  before(async () => {
    //build server and express app
    const { buildServer } = require('../../src/server');
    const out = await buildServer();
    app = out.app;

    //create user
    const u = await request(app)
      .post('/api/users')
      .send({ username: 'testUser', email: 'testuser@example.com' });
    userId = u.body._id;

    //create group owner by that user
    const g = await request(app)
      .post('/api/groups')
      .send({ name: 'MsgGroup', ownerId: userId });
    groupId = g.body._id;
    //create channel inside group
    const c = await request(app)
      .post(`/api/groups/${groupId}/channels`)
      .send({ name: 'testchannel' });
    channelId = c.body._id;
  });

  //test message without text or images
  it('POST /api/channels/:channelId/messages -> 400 when body & image missing', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/messages`)
      .send({ userId });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error');
  });

  //test valid message 
  it('POST /api/channels/:channelId/messages -> creates a message', async () => {
    const res = await request(app)
      .post(`/api/channels/${channelId}/messages`)
      .send({ userId, text: 'hello world' });
    expect(res.status).to.equal(201);
    expect(res.body).to.include.keys('_id', 'channelId', 'senderId', 'body', 'createdAt');
    expect(res.body.body).to.equal('hello world');
  });
   
  //return message list
  it('GET /api/channels/:channelId/messages -> returns list with our message', async () => {
    const res = await request(app).get(`/api/channels/${channelId}/messages`);
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    const bodies = res.body.map(m => m.body).filter(Boolean);
    expect(bodies).to.include('hello world');
  });
});
