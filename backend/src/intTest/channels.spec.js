const request = require('supertest');
const { expect } = require('chai');

describe('Channels API', function () {
  let app;
  let ownerId;
  let groupId;
  let channelId;

  before(async () => {
    const { buildServer } = require('../../src/server');
    const out = await buildServer();
    app = out.app;

    const owner = await request(app)
      .post('/api/users')
      .send({ username: 'ChanOwner', email: 'chanowner@example.com' });
    ownerId = owner.body._id;

    const group = await request(app)
      .post('/api/groups')
      .send({ name: 'ChanGroup', ownerId });
    groupId = group.body._id;
  });

  it('POST /api/groups/:groupId/channels -> creates a channel', async () => {
    const res = await request(app)
      .post(`/api/groups/${groupId}/channels`)
      .send({ name: 'General' });
    expect(res.status).to.equal(201);
    expect(res.body).to.include.keys('_id', 'name', 'groupId');
    channelId = res.body._id;
  });

  it('GET /api/groups/:groupId/channels -> lists channels', async () => {
    const res = await request(app).get(`/api/groups/${groupId}/channels`);
    expect(res.status).to.equal(200);
    const names = res.body.map(c => c.name);
    expect(names).to.include('General');
  });

  it('DELETE /api/channels/:id -> deletes channel', async () => {
    const res = await request(app).delete(`/api/channels/${channelId}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ ok: true });
  });
});
