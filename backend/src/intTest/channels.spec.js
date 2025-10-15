//import supertest and chai
const request = require('supertest');
const { expect } = require('chai');

//start test group
describe('Channels API', function () {
  let app;
  let ownerId;
  let groupId;
  let channelId;

  //before startup
  before(async () => {
    //build server
    const { buildServer } = require('../../src/server');
    const out = await buildServer();
    app = out.app;
    //make group owner via api
    const owner = await request(app)
      .post('/api/users')
      .send({ username: 'TestOwner', email: 'testowner@gmail.com' });
    ownerId = owner.body._id;
    //create group owned by that user
    const group = await request(app)
      .post('/api/groups')
      .send({ name: 'TestOwner', ownerId });
    groupId = group.body._id;
  });
  //create channel within group
  it('POST /api/groups/:groupId/channels -> creates a channel', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/channels`)
      .send({ name: 'TestChannel' });
    expect(res.status).to.equal(201);
    expect(res.body).to.include.keys('_id', 'name', 'groupId');
    channelId = res.body._id;
  });
   //List channels
  it('GET /api/groups/:groupId/channels -> lists channels', async () => {
    const res = await request(app).get(`/api/groups/${groupId}/channels`);
    expect(res.status).to.equal(200);
    const names = res.body.map(c => c.name);
  });
  //Delete Channel
  it('DELETE /api/channels/:id -> deletes channel', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ ok: true });
  });
});
