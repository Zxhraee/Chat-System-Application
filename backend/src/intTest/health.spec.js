//import chai
const chai = require('chai');
require('chai-http');    
//use chai plugin and and chai expect function
chai.use(require('chai-http'));
const { expect } = chai;

//start Api/Health tests
describe('GET/api/health', function () {
  let app;

  //before test run
  before(async () => {
    //construct server and build express app
    const { buildServer } = require('../server'); 
    const out = await buildServer();
    app = out.app; 
  });

  //build in memory app and send GET response to API/health
  //Checking to see route not missing, DB is wired properly and DB field is a string
  it('returns ok with db name', async () => {
    const res = await chai.request(app).get('/api/health');
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('ok', true);
    expect(res.body).to.have.property('db').that.is.a('string');
  });
});
