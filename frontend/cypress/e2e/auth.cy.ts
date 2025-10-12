describe('Auth', () => {
  it('logs in successfully', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { token: 't', user: { id:'U2', username:'Zahra', role:'USER' } }
    }).as('login');

    cy.visit('/login');
    cy.get('input[name="username"]').type('zahra');
    cy.get('input[name="password"]').type('pass{enter}');
    cy.wait('@login');
    cy.contains(/welcome|logout|groups|chat/i);
  });
});
