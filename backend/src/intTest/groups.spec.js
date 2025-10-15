//load supertest and chai
const request = require('supertest');
const { expect } = require('chai');

//start Groups API test 
describe('Groups API', function () {
  let app;
  let ownerId;
  let groupId;

  //before start
  before(async () => {
    //build the server
    const { buildServer } = require('../../src/server');
    const out = await buildServer();
    app = out.app;

    //create group admin user
    const ownerRes = await request(app)
      .post('/api/users')
      .send({ username: 'TestGroupAdmin', email: 'testgroupadmin@gmail.com' });
    ownerId = ownerRes.body._id;
  });
  
  //create group 
  it('POST /api/groups -> creates a group', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'TestGroup', ownerId });
    expect(res.status).to.equal(201);
    expect(res.body).to.include.keys('_id', 'name');
    groupId = res.body._id;
  });

  //List groups
  it('GET /api/groups -> lists groups incl created one', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).to.equal(200);
    const names = res.body.map(g => g.name);
    expect(names).to.include('TestGroup');
  });

  //Rename group
  it('PATCH /api/groups/:groupId -> renames group', async () => {
    const res = await request(app)
      .patch(`/api/groups/${groupId}`)
      .send({ name: 'RenamedGroup' });
    expect(res.status).to.equal(200);
    expect(res.body.name).to.equal('RenamedGroup');
  });

  //Add member to group
  it('POST /api/groups/:groupId/members -> adds member to group', async () => {
    const u2 = await request(app)
      .post('/api/users')
      .send({ username: 'User', email: 'user@gmail.com' });

    const res = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .send({ userId: u2.body._id });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('_id');
    expect(res.body.memberIds).to.be.an('array');
  });

  //Delete Group
  it('DELETE /api/groups/:groupId -> deletes group', async () => {
    const res = await request(app).delete(`/api/groups/${groupId}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ ok: true });
  });
});
