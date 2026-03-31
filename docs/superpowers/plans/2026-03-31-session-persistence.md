# Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement HTTP route session persistence via trackingId, allowing clients to reuse browser sessions across requests while preserving cookies, cache, localStorage, and sessionStorage.

**Architecture:** Extend existing BrowserManager to support session lookup by trackingId, add TTL-based session expiration, and modify the router layer to pass pre-created/reused pages to HTTP route handlers.

**Tech Stack:** TypeScript, Puppeteer, Node.js

---

## File Structure

**Modified files:**
- `src/types.ts` - Add `lastActivityTime` to BrowserlessSession, update BrowserHTTPRoute handler signature
- `src/config.ts` - Add SESSION_TTL configuration
- `src/browsers/index.ts` - Add session lookup and TTL management methods
- `src/router.ts` - Modify to pass page to BrowserHTTPRoute handlers
- `src/shared/pdf.http.ts` - Update handler to accept page parameter
- `src/shared/screenshot.http.ts` - Update handler to accept page parameter
- `src/shared/content.http.ts` - Update handler to accept page parameter
- `src/shared/scrape.http.ts` - Update handler to accept page parameter
- `src/shared/download.http.ts` - Update handler to accept page parameter
- `src/shared/performance.http.ts` - Update handler to accept page parameter
- `src/shared/function.http.ts` - Update handler to accept page parameter

**New files:**
- `src/browsers/tests/session-persistence.spec.ts` - Unit tests for session persistence

---

### Task 1: Add lastActivityTime to BrowserlessSession type

**Files:**
- Modify: `src/types.ts:410-422`

- [ ] **Step 1: Add lastActivityTime field to BrowserlessSession interface**

Open `src/types.ts` and find the `BrowserlessSession` interface (around line 410). Add the `lastActivityTime` field:

```typescript
export interface BrowserlessSession {
  id: string;
  initialConnectURL: string;
  isTempDataDir: boolean;
  launchOptions: CDPLaunchOptions | BrowserServerOptions;
  numbConnected: number;
  resolver(val: unknown): void;
  routePath: string | string[];
  startedOn: number;
  trackingId?: string;
  ttl: number;
  userDataDir: string | null;
  lastActivityTime: number;  // Added for session persistence TTL
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add lastActivityTime to BrowserlessSession interface"
```

---

### Task 2: Add SESSION_TTL configuration

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add sessionTTL property to Config class**

Find the protected properties section in `src/config.ts` (around line 175). Add:

```typescript
protected sessionTTL = +(process.env.SESSION_TTL ?? '1800000'); // Default 30 minutes
```

- [ ] **Step 2: Add getter method**

Find the getter methods section. Add:

```typescript
public getSessionTTL(): number {
  return this.sessionTTL;
}
```

- [ ] **Step 3: Add setter method**

Find the setter methods section. Add:

```typescript
public setSessionTTL(ttl: number): number {
  this.emit('sessionTTL', ttl);
  return (this.sessionTTL = ttl);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/config.ts
git commit -m "feat: add SESSION_TTL configuration option"
```

---

### Task 3: Add session lookup and TTL management to BrowserManager

**Files:**
- Modify: `src/browsers/index.ts`

- [ ] **Step 1: Add Page import**

At the top of the file, ensure Page is imported. Find the import from puppeteer-core (around line 38) and add Page if not present:

```typescript
import { Page } from 'puppeteer-core';
```

- [ ] **Step 2: Add sessionTTLTimers Map for TTL management**

Find the protected properties section (around line 43-47). Add after `timers`:

```typescript
protected sessionTTLTimers: Map<string, NodeJS.Timeout> = new Map();
```

- [ ] **Step 3: Add findSessionByTrackingId method**

Add this method after the `killSessions` method (around line 377):

```typescript
/**
 * Finds an existing session by trackingId.
 * Returns the browser, session, and first page if found and running.
 */
public findSessionByTrackingId(
  trackingId: string,
): { browser: BrowserInstance; session: BrowserlessSession; page: Page | null } | null {
  for (const [browser, session] of this.browsers) {
    if (session.trackingId === trackingId && browser.isRunning()) {
      // Get the first page if available
      let page: Page | null = null;
      if (this.browserIsChrome(browser) && browser.wsEndpoint()) {
        try {
          const port = new URL(browser.wsEndpoint()!).port;
          // For CDP browsers, we'll return null for page - the router will create one
        } catch {
          // Ignore errors
        }
      }
      return { browser, session, page };
    }
  }
  return null;
}
```

- [ ] **Step 3: Add refreshSessionActivity method**

Add after `findSessionByTrackingId`:

```typescript
/**
 * Refreshes the session's last activity time and resets the TTL timer.
 */
public refreshSessionActivity(trackingId: string): void {
  for (const [browser, session] of this.browsers) {
    if (session.trackingId === trackingId) {
      session.lastActivityTime = Date.now();

      // Clear existing TTL timer
      const existingTimer = this.sessionTTLTimers.get(session.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new TTL timer
      const ttl = this.config.getSessionTTL();
      if (ttl > 0) {
        const timer = setTimeout(() => {
          const currentSession = this.browsers.get(browser);
          if (currentSession && currentSession.numbConnected === 0) {
            this.log.debug(`Session "${trackingId}" TTL expired, closing`);
            this.close(browser, currentSession, true);
          }
        }, ttl);
        this.sessionTTLTimers.set(session.id, timer);
      }
      return;
    }
  }
}
```

- [ ] **Step 4: Modify session creation to set lastActivityTime**

Find the session creation in `getBrowserForRequest` (around line 634). Update the session object:

```typescript
const session: BrowserlessSession = {
  id: sessionId,
  initialConnectURL:
    path.join(req.parsed.pathname, req.parsed.search) || '',
  isTempDataDir: !manualUserDataDir,
  launchOptions,
  numbConnected: 1,
  resolver: noop,
  routePath: router.path,
  startedOn: Date.now(),
  trackingId,
  ttl: 0,
  userDataDir,
  lastActivityTime: Date.now(),  // Add this line
};
```

- [ ] **Step 5: Update shutdown to clear sessionTTLTimers**

Find the `shutdown` method (around line 665). Update to include:

```typescript
public async shutdown(): Promise<void> {
  this.log.info(`Closing down browser instances`);
  const sessions = Array.from(this.browsers);
  await Promise.all(sessions.map(([b]) => b.close()));
  const timers = Array.from(this.timers);
  await Promise.all(timers.map(([, timer]) => clearInterval(timer)));
  this.timers.forEach((t) => clearTimeout(t));
  this.sessionTTLTimers.forEach((t) => clearTimeout(t));  // Add this line
  this.browsers = new Map();
  this.timers = new Map();
  this.sessionTTLTimers = new Map();  // Add this line
  await this.stop();
  this.log.info(`Shutdown complete`);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/browsers/index.ts
git commit -m "feat: add session lookup and TTL management to BrowserManager"
```

---

### Task 4: Modify getBrowserForRequest to support session reuse

**Files:**
- Modify: `src/browsers/index.ts`

- [ ] **Step 1: Add page storage to track reusable pages**

Add to protected properties (around line 47):

```typescript
protected reusablePages: Map<string, Page> = new Map();
```

- [ ] **Step 2: Modify getBrowserForRequest to check for existing session by trackingId**

Find the `getBrowserForRequest` method. Before the trackingId validation (around line 433), add session reuse logic:

```typescript
public async getBrowserForRequest(
  req: Request,
  router: BrowserHTTPRoute | BrowserWebsocketRoute,
  logger: Logger,
): Promise<BrowserInstance> {
  const { browser: Browser } = router;
  const blockAds = parseBooleanParam(
    req.parsed.searchParams,
    'blockAds',
    false,
  );
  const trackingId =
    parseStringParam(req.parsed.searchParams, 'trackingId', '') || undefined;

  // Handle session reuse via trackingId for HTTP routes
  if (trackingId && !this.reconnectionPatterns.some((p) => req.parsed.pathname.includes(p))) {
    const existing = this.findSessionByTrackingId(trackingId);
    if (existing) {
      this.log.debug(`Reusing existing session with trackingId "${trackingId}"`);
      ++existing.session.numbConnected;
      this.refreshSessionActivity(trackingId);
      return existing.browser;
    }
    // Session doesn't exist, will create new one with this trackingId
    this.log.debug(`Creating new session with trackingId "${trackingId}"`);
  }

  // Handle trackingId validation for new sessions
  if (trackingId) {
    // Remove the existing check since we now allow reuse
    if (trackingId.length > 32) {
      throw new BadRequest(
        `TrackingId "${trackingId}" must be less than 32 characters`,
      );
    }

    if (!micromatch.isMatch(trackingId, '+([0-9a-zA-Z-_])')) {
      throw new BadRequest(`trackingId contains invalid characters`);
    }

    if (trackingId === 'all') {
      throw new BadRequest(`trackingId cannot be the reserved word "all"`);
    }

    this.log.debug(`Assigning session trackingId "${trackingId}"`);
  }
```

Note: Remove the existing duplicate trackingId check (the forEach loop that throws BadRequest for existing trackingId).

- [ ] **Step 3: Find and remove the duplicate trackingId check**

Find and remove this block (around line 434-440):

```typescript
// Handle trackingId
if (trackingId) {
  this.browsers.forEach((b) => {
    if (b.trackingId === trackingId) {
      throw new BadRequest(
        `A browser session with trackingId "${trackingId}" already exists`,
      );
    }
  });
```

Replace it with the new logic from Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/browsers/index.ts
git commit -m "feat: modify getBrowserForRequest to support session reuse via trackingId"
```

---

### Task 5: Update BrowserHTTPRoute handler signature in types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update BrowserHTTPRoute abstract handler signature**

Find the `BrowserHTTPRoute` class (around line 270). Update the handler signature:

```typescript
export abstract class BrowserHTTPRoute extends BasicHTTPRoute {
  defaultLaunchOptions?: defaultLaunchOptions;

  abstract browser: BrowserClasses;

  /**
   * Whether this route supports session reuse via trackingId.
   * Default is true.
   */
  supportsSessionReuse: boolean = true;

  /**
   * Handles an inbound HTTP request with a 3rd param of the predefined
   * browser used for the route -- only Chrome CDP is support currently.
   * @param req The incoming request
   * @param res The server response
   * @param logger Logger instance
   * @param browser The browser instance
   * @param page The page instance (newly created in the browser context)
   * @param isNewSession Whether this is a newly created browser session
   */
  abstract handler(
    req: Request,
    res: http.ServerResponse,
    logger: Logger,
    browser: BrowserInstance,
    page: Page,
    isNewSession: boolean,
  ): Promise<unknown>;

  /**
   * An optional function to automatically set up or handle new page
   * creation. Useful for injecting behaviors or other functionality.
   */
  onNewPage?: (url: URL, page: Page) => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: update BrowserHTTPRoute handler signature to include page parameter"
```

---

### Task 6: Modify router to pass page to BrowserHTTPRoute handlers

**Files:**
- Modify: `src/router.ts`

- [ ] **Step 1: Add Page import**

At the top of `src/router.ts`, add Page import from puppeteer-core:

```typescript
import { Page } from 'puppeteer-core';
```

- [ ] **Step 2: Update wrapHTTPHandler to pass page to handler**

Find the `wrapHTTPHandler` method and update the BrowserHTTPRoute handling section (around line 63-116). The key changes:
- Create a new page for each request (pages share browser context which preserves cookies, localStorage, etc.)
- Always close the page after the request completes
- Pass `isNewSession` to indicate if this is a new or reused browser session

```typescript
protected wrapHTTPHandler(
  route: HTTPRoute | BrowserHTTPRoute,
  handler: HTTPRoute['handler'] | BrowserHTTPRoute['handler'],
) {
  return async (req: Request, res: Response) => {
    if (!isConnected(res)) {
      this.log.warn(`HTTP Request has closed prior to running`);
      return Promise.resolve();
    }
    const logger = new this.logger(route.name, req);
    if (
      Object.getPrototypeOf(route) instanceof BrowserHTTPRoute &&
      'browser' in route &&
      route.browser
    ) {
      const browser = await this.browserManager.getBrowserForRequest(
        req,
        route,
        logger,
      );

      if (!isConnected(res)) {
        this.log.warn(`HTTP Request has closed prior to running`);
        this.browserManager.complete(browser);
        return Promise.resolve();
      }

      if (!browser) {
        return writeResponse(res, 500, `Error loading the browser`);
      }

      // Get trackingId from request
      const trackingId = req.parsed.searchParams.get('trackingId') || undefined;

      // Determine if this is a reused session
      const existingSession = trackingId
        ? this.browserManager.findSessionByTrackingId(trackingId)
        : null;
      const isNewSession = !existingSession || existingSession.browser !== browser;

      // Create page - each request gets a new page, but they share the browser context
      // which preserves cookies, localStorage, sessionStorage, and cache
      const page = await browser.newPage();

      try {
        this.log.trace(`Running found HTTP handler.`);
        return await Promise.race([
          (handler as BrowserHTTPRoute['handler'])(
            req,
            res,
            logger,
            browser,
            page,
            isNewSession,
          ),
          new Promise((resolve, reject) => {
            res.once('close', () => {
              if (!res.writableEnded) {
                reject(new Error(`Request closed prior to writing results`));
              }
              this.log.trace(`Response has been written, resolving`);
              resolve(null);
            });
          }),
        ]);
      } finally {
        this.log.trace(`HTTP Request handler has finished.`);
        // Always close the page - browser context (cookies, localStorage) persists
        page.close().catch(() => {});
        this.browserManager.complete(browser);
      }
    }

    return (handler as HTTPRoute['handler'])(req, res, logger);
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/router.ts
git commit -m "feat: modify router to pass page to BrowserHTTPRoute handlers"
```

---

### Task 7: Update PDF route to use new handler signature

**Files:**
- Modify: `src/shared/pdf.http.ts`

- [ ] **Step 1: Update handler signature and remove newPage call**

Update the handler method:

```typescript
async handler(
  req: Request,
  res: ServerResponse,
  logger: Logger,
  browser: BrowserInstance,
  page: Page,
  isNewSession: boolean,
): Promise<void> {
  logger.info('PDF API invoked with body:', req.body);
  const contentType =
    !req.headers.accept || req.headers.accept?.includes('*')
      ? 'application/pdf'
      : req.headers.accept;

  if (!req.body) {
    throw new BadRequest(`Couldn't parse JSON body`);
  }

  res.setHeader('Content-Type', contentType);

  const {
    url,
    gotoOptions,
    authenticate,
    html,
    addScriptTag = [],
    addStyleTag = [],
    cookies = [],
    emulateMediaType,
    rejectRequestPattern = [],
    requestInterceptors = [],
    rejectResourceTypes = [],
    options,
    setExtraHTTPHeaders,
    setJavaScriptEnabled,
    userAgent,
    viewport,
    waitForEvent,
    waitForFunction,
    waitForSelector,
    waitForTimeout,
    bestAttempt = false,
  } = req.body as BodySchema;

  const content = url || html;

  if (!content) {
    throw new BadRequest(`One of "url" or "html" properties are required.`);
  }

  if (options?.fullPage && (options?.height || options?.format)) {
    throw new BadRequest(`"fullPage" option cannot be used with "height" or "format" options.`);
  }

  // Page is now passed in, no need to create it
  // Remove: const page = (await browser.newPage()) as UnwrapPromise<ReturnType<ChromiumCDP['newPage']>>;
  const gotoCall = url ? page.goto.bind(page) : page.setContent.bind(page);

  // ... rest of the handler remains the same until page.close()
```

- [ ] **Step 2: Remove page.close() call at the end**

Find and remove the `page.close().catch(noop);` line (around line 286). The router now handles page lifecycle.

- [ ] **Step 3: Commit**

```bash
git add src/shared/pdf.http.ts
git commit -m "feat: update PDF route to use new handler signature with page parameter"
```

---

### Task 8: Update Screenshot route to use new handler signature

**Files:**
- Modify: `src/shared/screenshot.http.ts`

- [ ] **Step 1: Update handler signature**

```typescript
async handler(
  req: Request,
  res: ServerResponse,
  logger: Logger,
  browser: BrowserInstance,
  page: Page,
  isNewSession: boolean,
): Promise<void> {
  // ... existing code until page creation ...
```

- [ ] **Step 2: Remove newPage call and page.close()**

Remove:
```typescript
const page = (await browser.newPage()) as UnwrapPromise<
  ReturnType<ChromiumCDP['newPage']>
>;
```

And remove at the end:
```typescript
page.close().catch(noop);
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/screenshot.http.ts
git commit -m "feat: update Screenshot route to use new handler signature"
```

---

### Task 9: Update remaining HTTP routes

**Files:**
- Modify: `src/shared/content.http.ts`
- Modify: `src/shared/scrape.http.ts`
- Modify: `src/shared/download.http.ts`
- Modify: `src/shared/performance.http.ts`
- Modify: `src/shared/function.http.ts`

- [ ] **Step 1: Update content.http.ts**

Same pattern:
- Add `page: Page, isNewSession: boolean` to handler signature
- Remove `browser.newPage()` call
- Remove `page.close().catch(noop)` at the end

- [ ] **Step 2: Update scrape.http.ts**

Same pattern as above.

- [ ] **Step 3: Update download.http.ts**

Same pattern as above.

- [ ] **Step 4: Update performance.http.ts**

Same pattern as above.

- [ ] **Step 5: Update function.http.ts**

Same pattern as above.

- [ ] **Step 6: Commit all route changes**

```bash
git add src/shared/content.http.ts src/shared/scrape.http.ts src/shared/download.http.ts src/shared/performance.http.ts src/shared/function.http.ts
git commit -m "feat: update remaining HTTP routes to use new handler signature"
```

---

### Task 10: Add integration tests for session persistence

**Files:**
- Create: `src/routes/chromium/tests/session-persistence.spec.ts`

- [ ] **Step 1: Write failing test for session reuse**

```typescript
import { Browserless, Config, Metrics } from '@browserless.io/browserless';
import { expect } from 'chai';

describe('Session Persistence via trackingId', function () {
  let browserless: Browserless;

  const start = ({
    config = new Config(),
    metrics = new Metrics(),
  }: { config?: Config; metrics?: Metrics } = {}) => {
    browserless = new Browserless({ config, metrics });
    return browserless.start();
  };

  afterEach(async () => {
    await browserless.stop();
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

  it('preserves cookies across requests with same trackingId', async () => {
    const config = new Config();
    config.setToken('browserless');
    await start({ config });

    // First request sets a cookie
    const body1 = {
      url: 'https://httpbin.org/cookies/set/testcookie/testvalue',
      gotoOptions: { waitUntil: 'networkidle2' as const },
    };

    await fetch(
      'http://localhost:3000/chromium/screenshot?token=browserless&trackingId=cookie-session',
      {
        body: JSON.stringify(body1),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    // Second request should have the cookie preserved
    const body2 = { url: 'https://httpbin.org/cookies' };
    const res2 = await fetch(
      'http://localhost:3000/chromium/content?token=browserless&trackingId=cookie-session',
      {
        body: JSON.stringify(body2),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    const content = await res2.text();
    expect(content).to.include('testcookie');
    expect(content).to.include('testvalue');
  });
});
```

- [ ] **Step 2: Run tests to verify**

```bash
npm run build
npm run test
```

Expected: Tests should pass if implementation is correct.

- [ ] **Step 3: Commit tests**

```bash
git add src/routes/chromium/tests/session-persistence.spec.ts
git commit -m "test: add integration tests for session persistence"
```

---

### Task 11: Build and run full test suite

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: All tests pass, including new session persistence tests.

- [ ] **Step 3: Fix any failing tests**

If tests fail, investigate and fix the issues. Common issues:
- Type mismatches in handler signatures
- Missing imports
- Incorrect page lifecycle management

---

### Task 12: Final commit and documentation

- [ ] **Step 1: Ensure all changes are committed**

```bash
git status
```

If there are uncommitted changes:

```bash
git add -A
git commit -m "feat: complete session persistence implementation"
```

- [ ] **Step 2: Push to remote (if applicable)**

```bash
git push origin main
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Session reuse works with trackingId parameter
- [ ] TTL mechanism closes idle sessions
- [ ] Existing routes still work without trackingId
- [ ] Cookies and localStorage persist across requests with same trackingId