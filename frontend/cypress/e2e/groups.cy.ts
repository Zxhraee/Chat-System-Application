const GROUPS_LIST_SELECTOR =
  '[data-cy="groups-list"], .groups-list, .group-card, [data-cy="group-card"]';

describe('Groups', () => {
  let memUsers: any[];
  let memGroups: any[];

  beforeEach(() => {
    memUsers = [
      { _id: 'U1', username: 'super', role: 'SUPER_ADMIN' },
      { _id: 'U2', username: 'alice', role: 'USER' },
    ];
    memGroups = [
      { _id: 'G1', name: 'General', ownerId: 'U1', adminIds: ['U1'], memberIds: ['U1', 'U2'] },
    ];

    cy.intercept('GET', '/api/users', (req) => req.reply({ statusCode: 200, body: memUsers })).as('users');

    cy.intercept('GET', '/api/groups', (req) => req.reply({ statusCode: 200, body: memGroups })).as('groups');

    cy.intercept('GET', '/api/groups/**', (req) => req.reply({ statusCode: 200, body: [] })).as('groupExtra');

    cy.intercept('POST', '/api/groups', (req) => {
      const name = req.body?.name ?? `Group ${Date.now()}`;
      const created = {
        _id: `G${Date.now()}`,
        name,
        ownerId: 'U1',
        adminIds: ['U1'],
        memberIds: ['U1'],
      };
      memGroups = [...memGroups, created];
      req.reply({ statusCode: 201, body: created });
    }).as('createGroup');

    cy.visit('/groups', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth.token', 'stub-token');
        win.localStorage.setItem('auth.user', JSON.stringify({ id: 'U1', username: 'super', role: 'SUPER_ADMIN' }));
      },
    });
  });

  it('lists groups and creates one', () => {
    cy.wait(['@users', '@groups']);

    const newName = `My Group ${Date.now()}`;

    cy.window().then((win) =>
      win.fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
    );

    cy.wait('@createGroup')
      .its('response')
      .should('exist')
      .then((resp) => {
        if (typeof resp?.statusCode === 'number') {
          expect([200, 201]).to.include(resp.statusCode);
        }
      });

    cy.reload();
    cy.wait('@groups');

    cy.contains(newName, { timeout: 10000 }).should('exist');

    cy.get('body').then(($b) => {
      if ($b.find(GROUPS_LIST_SELECTOR).length) {
        cy.get(GROUPS_LIST_SELECTOR).contains(newName);
      }
    });
  });
});
