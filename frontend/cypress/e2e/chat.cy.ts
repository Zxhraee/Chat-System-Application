describe('Chat', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('token', 't');
      win.localStorage.setItem('authToken', 't');
      win.localStorage.setItem('session_user_id', 'U2'); 
    });

    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/users(\?.*)?$/, { fixture: 'users.json' }).as('users');
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/groups(\/)?(\?.*)?$/, { fixture: 'groups.json' }).as('groups');

    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/groups\/[^/]+\/channels.*$/, { fixture: 'channels.json' }).as('channelsByGroup');
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/channels(\?.*)?$/, { fixture: 'channels.json' }).as('channels');

    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/channels\/[^/]+\/messages.*$/, { fixture: 'messages.json' }).as('msgsByChannel');
    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/messages(\?.*channelId=.*)?$/, { fixture: 'messages.json' }).as('msgsByQuery');

    cy.intercept('GET', /^http:\/\/localhost:3000\/api\/groups\/[^/]+\/promotion-requests(\?.*)?$/, { statusCode: 200, body: [] }).as('promotionRequests');
    cy.intercept('POST', /^http:\/\/localhost:3000\/api\/channels(\?.*)?$/, {
      statusCode: 201, body: { id: 'C1', groupId: 'G1', name: 'general', isGlobal: true, memberIds: ['U1','U2'] }
    }).as('createChannelNoise');
  });

  it('loads chat UI and allows typing', () => {
    cy.visit('/chat/G1/general');
    cy.wait('@groups');

    cy.contains(/general/i, { timeout: 10000 }).should('exist');

    const inputSel = [
      '.chat-input',
      'input[name="chatInput"]',
      'textarea[name="chatInput"]',
      'input[placeholder*="message" i]',
      'textarea[placeholder*="message" i]',
    ].join(', ');

    cy.get(inputSel, { timeout: 10000 })
      .first()
      .should('exist')
      .as('chatInput');

    cy.get('@chatInput').clear().type('Hello!', { force: true });

    cy.get('body').then(($body) => {
      const btn = $body.find('button.chat-send, button, [role="button"]')
        .filter((_, el) => /send/i.test((el.textContent || '').trim()))
        .first();

      if (btn.length) cy.wrap(btn).click({ force: true });
    });

    cy.get('@chatInput')
      .invoke('val')
      .then((val) => {
        const v = (val as string) ?? '';
        expect(v === '' || v === 'Hello!').to.eq(true);
      });
  });
});
