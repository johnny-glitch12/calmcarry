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

  it('flags APPLE_APP_APPLE_ID when Apple IAP is active but the numeric app id is unset', () => {
    const { APPLE_APP_APPLE_ID, ...noAppleId } = validProdEnv;
    expect(gapsFor(noAppleId)).toContain('APPLE_APP_APPLE_ID');
  });

  it('flags APPLE_APP_APPLE_ID when it is set to a non-numeric / zero value', () => {
    expect(gapsFor({ ...validProdEnv, APPLE_APP_APPLE_ID: '0' })).toContain('APPLE_APP_APPLE_ID');
    expect(gapsFor({ ...validProdEnv, APPLE_APP_APPLE_ID: 'not-a-number' })).toContain('APPLE_APP_APPLE_ID');
  });

  it('does NOT require APPLE_APP_APPLE_ID when Apple IAP is inactive (Google-only)', () => {
    const { APPLE_ROOT_CERTS_DIR, APPLE_APP_APPLE_ID, ...googleOnly } = validProdEnv;
    const gaps = gapsFor({ ...googleOnly, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}' });
    expect(gaps).not.toContain('APPLE_APP_APPLE_ID');
    expect(gaps).toEqual([]);
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
