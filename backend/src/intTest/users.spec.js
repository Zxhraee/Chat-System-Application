const request = require('supertest');
const { expect } = require('chai');

describe('Users API', function () {
    let app;

    before(async () => {
        const { buildServer } = require('../../src/server');
        const out = await buildServer();
        app = out.app;
    });

    it('GET /api/users -> returns an array', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
    });

    it('POST /api/users -> 400 on missing username/email', async () => {
        const res = await request(app).post('/api/users').send({});
        expect(res.status).to.equal(400);
        expect(res.body).to.have.property('error');
    });

    it('POST /api/users -> inserts a user', async () => {
        const payload = { username: 'Naila', email: 'naila@gmail.com' };
        const res = await request(app).post('/api/users').send(payload);
        expect(res.status).to.equal(201);
        expect(res.body).to.include.keys('_id', 'username', 'email');
        expect(res.body.username).to.equal('Naila');
    });

    it('PATCH /api/users/:id -> updates fields', async () => {
        const u = await request(app).post('/api/users').send({ username: 'X', email: 'x@x.com' });
        const id = u.body._id;

        const res = await request(app).patch(`/api/users/${id}`).send({ username: 'X2' });
        expect(res.status).to.equal(200);
        expect(res.body).to.include.keys('_id', 'username');
        expect(res.body.username).to.equal('X2');
    });

    it('DELETE /api/users/:id -> ok true', async () => {
        const u = await request(app).post('/api/users').send({ username: 'Del', email: 'del@del.com' });
        const id = u.body._id;

        const res = await request(app).delete(`/api/users/${id}`);
        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ ok: true });
    });

    it('GET /api/users -> includes Naila after insert', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).to.equal(200);
        const names = res.body.map(u => u.username);
        expect(names).to.include('Naila');
    });

});
