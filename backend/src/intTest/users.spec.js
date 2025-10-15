//load supertest and chai
const request = require('supertest');
const { expect } = require('chai');

//start users API test
describe('Users API', function () {
    let app;

    //before test run
    before(async () => {
        //build server and express app
        const { buildServer } = require('../../src/server');
        const out = await buildServer();
        app = out.app;
    });

    //return all users
    it('GET /api/users -> returns an array', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
    });

    //create users - missing fields
    it('POST /api/users -> 400 on missing username/email', async () => {
        const res = await request(app).post('/api/users').send({});
        expect(res.status).to.equal(400);
        expect(res.body).to.have.property('error');
    });

    //create valid user
    it('POST /api/users -> inserts a user', async () => {
        const payload = { username: 'Naila', email: 'naila@gmail.com' };
        const res = await request(app).post('/api/users').send(payload);
        expect(res.status).to.equal(201);
        expect(res.body).to.include.keys('_id', 'username', 'email');
        expect(res.body.username).to.equal('Naila');
    });

    //delete user
    it('DELETE /api/users/:id -> ok true', async () => {
        const u = await request(app).post('/api/users').send({ username: 'TestUser', email: 'test@gmail.com' });
        const id = u.body._id;

        const res = await request(app).delete(`/api/users/${id}`);
        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ ok: true });
    });

    //Get user list
    it('GET /api/users -> includes Naila after insert', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).to.equal(200);
        const names = res.body.map(u => u.username);
        expect(names).to.include('Naila');
    });
});
