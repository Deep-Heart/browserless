import { Browserless, Config, Metrics } from '@browserless.io/browserless';
import { expect } from 'chai';

describe('Session Persistence via trackingId', function () {
  this.timeout(60000);
  let browserless: Browserless;

  const start = ({
    config = new Config(),
    metrics = new Metrics(),
  }: { config?: Config; metrics?: Metrics } = {}) => {
    browserless = new Browserless({ config, metrics });
    return browserless.start();
  };

  afterEach(async () => {
    if (browserless) {
      await browserless.stop();
    }
  });

  it('reuses session when trackingId is provided', async () => {
    const config = new Config();
    config.setToken('browserless');
    await start({ config });

    const body = { url: 'https://example.com' };

    // First request - creates session
    const res1 = await fetch(
      'http://localhost:3000/chromium/pdf?token=browserless&trackingId=test-session',
      {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(res1.status).to.equal(200);

    // Second request - should reuse session
    const res2 = await fetch(
      'http://localhost:3000/chromium/pdf?token=browserless&trackingId=test-session',
      {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(res2.status).to.equal(200);

    // Verify sessions endpoint shows the session
    const sessionsRes = await fetch(
      'http://localhost:3000/sessions?token=browserless&trackingId=test-session',
    );
    expect(sessionsRes.status).to.equal(200);
    const sessions = await sessionsRes.json();
    expect(sessions).to.be.an('array');
    expect(sessions.length).to.be.greaterThan(0);
  });

  it('creates new session when trackingId does not exist', async () => {
    const config = new Config();
    config.setToken('browserless');
    await start({ config });

    const body = { url: 'https://example.com' };

    const res = await fetch(
      'http://localhost:3000/chromium/pdf?token=browserless&trackingId=new-session',
      {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(res.status).to.equal(200);
  });

  it('rejects invalid trackingId characters', async () => {
    const config = new Config();
    config.setToken('browserless');
    await start({ config });

    const body = { url: 'https://example.com' };

    const res = await fetch(
      'http://localhost:3000/chromium/pdf?token=browserless&trackingId=invalid@id',
      {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(res.status).to.equal(400);
  });

  it('rejects trackingId longer than 32 characters', async () => {
    const config = new Config();
    config.setToken('browserless');
    await start({ config });

    const body = { url: 'https://example.com' };
    const longTrackingId = 'a'.repeat(33);

    const res = await fetch(
      `http://localhost:3000/chromium/pdf?token=browserless&trackingId=${longTrackingId}`,
      {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(res.status).to.equal(400);
  });
});