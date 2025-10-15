//start menu test
describe('menu', () => {
  //before test setup
  beforeEach(() => {
    //make mock backend call to GET /api/users and return users fixture
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/users(\?.*)?$/, { fixture: 'users.json' }).as('users');
        //make mock backend call to GET /api/groups and return groups fixture
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/groups(\/)?(\?.*)?$/, { fixture: 'groups.json' }).as('groups');
  });

  //render home page and check displaying expected content
  it('loads home', () => {
    cy.visit('/');
    cy.contains(/groups|login|menu|chat/i, { timeout: 8000 }).should('exist');
  });
});
