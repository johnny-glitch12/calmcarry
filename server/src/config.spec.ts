/**
 * prodSecretGaps() is the production boot gate: main.ts and the serverless entry
 * both refuse to start if it returns anything. config.ts reads process.env at
 * IMPORT time, so each case sets the env and re-imports the module in isolation.
 */
describe('prodSecretGaps', () => {
  const OLD_ENV = process.env;

  // A complete, valid production env (Apple sign-in + Apple IAP active). Individual
  // tests delete one key to prove that key is required.
  const validProdEnv: Record<string, string> = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-real-rotated-production-secret',
    CMS_ADMIN_KEY: 'a-real-cms-key',
    DATABASE_URL: 'postgres://user:pass@host:5432/db',
    CORS_ORIGINS: 'https://app.theglowcompany.co',
    APPLE_SIGNIN_CLIENT_ID: 'co.theglowcompany.calmcarry',
    APPLE_ROOT_CERTS_DIR: '/certs/apple', // activates integrations.appleIap
    APPLE_APP_APPLE_ID: '1234567890', // numeric app id the Production verifier needs
  };

  const gapsFor = (env: Record<string, string>): string[] => {
    let result: string[] = [];
    jest.isolateModules(() => {
      process.env = { ...env } as NodeJS.ProcessEnv;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      result = require('./config').prodSecretGaps();
    });
    return result;
  };

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns no gaps when the full production secret set is present', () => {
    expect(gapsFor(validProdEnv)).toEqual([]);
  });

  it('returns [] in non-production regardless of missing secrets', () => {
    expect(gapsFor({ NODE_ENV: 'development' })).toEqual([]);
  });

  // APPLE_APP_APPLE_ID must NEVER abort startup. The numeric app id does not exist
  // until the App Store Connect record is created, and the live Railway service runs
  // with APPLE_ROOT_CERTS_DIR set and no app id - making this fatal would take
  // production down on the next deploy. It is a loud warning instead, and the money
  // path fail-closes (see receipt-validation.service).
  it('does NOT abort startup when APPLE_APP_APPLE_ID is unset (would brick a live deploy)', () => {
    const { APPLE_APP_APPLE_ID, ...noAppleId } = validProdEnv;
    expect(gapsFor(noAppleId)).toEqual([]);
  });

  it('reproduces the LIVE production env exactly and still boots', () => {
    // Mirrors the real Railway variable set: Apple certs + sign-in configured,
    // no Apple app id, no Google service account.
    const live = {
      NODE_ENV: 'production',
      JWT_SECRET: 'rotated-production-secret',
      CMS_ADMIN_KEY: 'rotated-cms-key',
      DATABASE_URL: 'postgresql://user:pw@host/db?sslmode=require',
      CORS_ORIGINS: 'https://app.theglowcompany.co',
      APPLE_SIGNIN_CLIENT_ID: 'co.theglowcompany.calmcarry',
      APPLE_ROOT_CERTS_DIR: '/app/certs/apple',
    };
    expect(gapsFor(live)).toEqual([]);
  });

  it('empty CMS_ADMIN_KEY is a gap (an unset Railway var yields "", not the default)', () => {
    expect(gapsFor({ ...validProdEnv, CMS_ADMIN_KEY: '' })).toContain('CMS_ADMIN_KEY');
  });

  it('still flags the classic gaps (JWT, DB, CORS, sign-in, IAP provider)', () => {
    const gaps = gapsFor({ NODE_ENV: 'production' });
    expect(gaps).toEqual(
      expect.arrayContaining([
        'JWT_SECRET',
        'DATABASE_URL',
        'CORS_ORIGINS',
        'APPLE_SIGNIN_CLIENT_ID or GOOGLE_SIGNIN_CLIENT_ID',
        'APPLE_ROOT_CERTS_DIR or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
      ]),
    );
  });
});

/**
 * Non-fatal warnings: conditions that must be impossible to miss in a deploy log,
 * but where refusing to boot would be the bigger outage.
 */
describe('prodConfigWarnings', () => {
  const OLD_ENV = process.env;
  const warnFor = (env: Record<string, string>): string[] => {
    let result: string[] = [];
    jest.isolateModules(() => {
      process.env = { ...env } as NodeJS.ProcessEnv;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      result = require('./config').prodConfigWarnings();
    });
    return result;
  };
  afterEach(() => {
    process.env = OLD_ENV;
  });

  const liveProd = {
    NODE_ENV: 'production',
    JWT_SECRET: 'rotated-production-secret',
    CMS_ADMIN_KEY: 'rotated-cms-key',
    DATABASE_URL: 'postgresql://user:pw@host/db',
    CORS_ORIGINS: 'https://app.theglowcompany.co',
    APPLE_SIGNIN_CLIENT_ID: 'co.theglowcompany.calmcarry',
    APPLE_ROOT_CERTS_DIR: '/app/certs/apple',
  };

  it('warns loudly when Apple IAP is active without a numeric app id', () => {
    const w = warnFor(liveProd);
    expect(w.join(' ')).toContain('APPLE_APP_APPLE_ID');
  });

  it('is silent once the app id is set', () => {
    expect(warnFor({ ...liveProd, APPLE_APP_APPLE_ID: '1234567890' })).toEqual([]);
  });

  it('warns when Play IAP is configured without a Pub/Sub service-account email', () => {
    const { APPLE_ROOT_CERTS_DIR, ...noApple } = liveProd;
    const w = warnFor({ ...noApple, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}' });
    expect(w.join(' ')).toContain('GOOGLE_PUBSUB_SA_EMAIL');
  });

  it('says nothing outside production', () => {
    expect(warnFor({ NODE_ENV: 'development' })).toEqual([]);
  });
});
