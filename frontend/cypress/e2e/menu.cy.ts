describe('menu', () => {
  beforeEach(() => {
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/users(\?.*)?$/, { fixture: 'users.json' }).as('users');
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/groups(\/)?(\?.*)?$/, { fixture: 'groups.json' }).as('groups');
  });

  it('loads home', () => {
    cy.visit('/');
    cy.contains(/groups|login|menu|chat/i, { timeout: 8000 }).should('exist');
  });
});
