//import supertest and chai
const request = require('supertest');
const { expect } = require('chai');

//start Auth API test suitee
describe('Auth API', function () {
  //declare variable to hold app instance and set username for test
  let app;
  let username = 'zahraUser';

  before(async () => {
    //import function to contruct express app, build server and store express app
    const { buildServer } = require('../server');
    const out = await buildServer();
    app = out.app;

    //create user for test login
    await request(app)
      .post('/api/users')
      .send({ username, email: 'zahra@gmail.com' });
  });

  //Login checks
  it('POST /api/auth/login -> returns token and user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: '123' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token').that.is.a('string');
    expect(res.body).to.have.property('user').that.includes({ username });
  });
});
