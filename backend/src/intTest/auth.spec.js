const request = require('supertest');
const { expect } = require('chai');

describe('Auth API', function () {
  let app;
  let username = 'loginUser';

  before(async () => {
    const { buildServer } = require('../server');
    const out = await buildServer();
    app = out.app;

    await request(app)
      .post('/api/users')
      .send({ username, email: 'login@example.com' });
  });

  it('POST /api/auth/login -> returns token and user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'anything' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token').that.is.a('string');
    expect(res.body).to.have.property('user').that.includes({ username });
  });
});
