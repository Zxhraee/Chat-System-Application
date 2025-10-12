const chai = require('chai');
require('chai-http');    
chai.use(require('chai-http'));
const { expect } = chai;

describe('GET /api/health', function () {
  let app;

  before(async () => {
    const { buildServer } = require('../server'); 
    const out = await buildServer();
    app = out.app; 
  });

  it('returns ok with db name', async () => {
    const res = await chai.request(app).get('/api/health');
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('ok', true);
    expect(res.body).to.have.property('db').that.is.a('string');
  });
});
