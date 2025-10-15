//Selector to match group names
const GROUPS_LIST_SELECTOR =
  '[data-cy="groups-list"], .groups-list, .group-card, [data-cy="group-card"]';

//start group test
describe('Groups', () => {
//in memory arrays for users and groups
  let memUsers: any[];
  let memGroups: any[];

  //before test run
  beforeEach(() => {
    //seed users
    memUsers = [
      { _id: 'U1', username: 'super', role: 'SUPER_ADMIN' },
      { _id: 'U2', username: 'zahra', role: 'USER' },
    ];
    //seed group
    memGroups = [
      { _id: 'G1', name: 'General', ownerId: 'U1', adminIds: ['U1'], memberIds: ['U1', 'U2'] },
    ]; 
    //make mock backend call to api/users and return memUsers
    cy.intercept('GET', '/api/users', (req) => req.reply({ statusCode: 200, body: memUsers })).as('users');
    //make mock backend calls to api/groups and return memGroups
    cy.intercept('GET', '/api/groups', (req) => req.reply({ statusCode: 200, body: memGroups })).as('groups');
    //any Get request starting with /api/groups/ and with anything following that route, reply with HTTP 200 and empty array
    cy.intercept('GET', '/api/groups/**', (req) => req.reply({ statusCode: 200, body: [] })).as('groupExtra');
    //any POST to /api/groups
    cy.intercept('POST', '/api/groups', (req) => { 
      //get group name from request, otherwise make one
      const name = req.body?.name ?? `Group ${Date.now()}`;
      //make fake group object
      const created = {
        _id: `G${Date.now()}`,
        name,
        ownerId: 'U1',
        adminIds: ['U1'],
        memberIds: ['U1'],
      };
      //push new group to in memory list
      memGroups = [...memGroups, created];
      req.reply({ statusCode: 201, body: created });
    }).as('createGroup');

    //visit page with fake login
    cy.visit('/groups', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth.token', 'stub-token');
        win.localStorage.setItem('auth.user', JSON.stringify({ id: 'U1', username: 'super', role: 'SUPER_ADMIN' }));
      },
    });
  });

  //create group and list groups
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
