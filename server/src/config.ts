import { join } from 'path';

/**
 * Central app config. Every secret is read from an env var with a SAFE
 * PLACEHOLDER default, so the server boots and the whole app works end-to-end
 * with zero keys. Drop real values into a `.env` (see .env.example) for prod.
 *
 * When an integration's keys are absent, its service runs in DEV-FALLBACK mode
 * (simulates success / returns local assets) so nothing is blocked on credentials.
 */
export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'calmcarry-dev-secret-change-me-in-production',
  // typed as an `ms`-style duration - @nestjs/jwt v11 requires StringValue, not string
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as import('ms').StringValue, // short-lived access; /auth/refresh rotates a 60d refresh token
  // file-based SQLite by default; set DATABASE_URL (Postgres) in production
  dbPath: process.env.DB_PATH ?? join(process.cwd(), 'data', 'calmcarry.sqlite'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: (process.env.DATABASE_SSL ?? 'true') !== 'false', // most hosted PG needs SSL
  // allowed browser origins in production (comma-separated); dev reflects all
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),

  // ---- Apple: Sign in with Apple + App Store IAP receipt validation ----
  apple: {
    bundleId: process.env.APPLE_BUNDLE_ID ?? 'co.theglowcompany.calmcarry',
    signInClientId: process.env.APPLE_SIGNIN_CLIENT_ID ?? '', // PLACEHOLDER
    iapSharedSecret: process.env.APPLE_IAP_SHARED_SECRET ?? '', // PLACEHOLDER
    verifyUrl: 'https://buy.itunes.apple.com/verifyReceipt',
    verifyUrlSandbox: 'https://sandbox.itunes.apple.com/verifyReceipt',
    // App Store Server Notifications V2 verification (webhooks):
    appAppleId: parseInt(process.env.APPLE_APP_APPLE_ID ?? '0', 10), // numeric app id (prod online checks)
    rootCertsDir: process.env.APPLE_ROOT_CERTS_DIR ?? '', // dir of Apple Root CA .cer/.pem files
    // Sign in with Apple revoke (App Store account-deletion requirement): the team id
    // + key id + .p8 private key that sign the client_secret JWT used to exchange the
    // auth code and revoke the user's Apple tokens when their account is deleted.
    signInTeamId: process.env.APPLE_TEAM_ID ?? '', // PLACEHOLDER
    signInKeyId: process.env.APPLE_SIGNIN_KEY_ID ?? '', // PLACEHOLDER
    signInKeyP8: (process.env.APPLE_SIGNIN_KEY_P8 ?? '').replace(/\\n/g, '\n'), // PLACEHOLDER (.p8 contents)
  },

  // ---- Google: Sign in with Google + Play Billing validation ----
  google: {
    playPackage: process.env.GOOGLE_PLAY_PACKAGE ?? 'co.theglowcompany.calmcarry',
    signInClientId: process.env.GOOGLE_SIGNIN_CLIENT_ID ?? '', // PLACEHOLDER
    playServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ?? '', // PLACEHOLDER
    // Play RTDN (Pub/Sub push) OIDC verification (webhooks):
    pubsubAudience: process.env.GOOGLE_PUBSUB_AUDIENCE ?? '', // expected `aud` of the push OIDC token
    pubsubServiceAccountEmail: process.env.GOOGLE_PUBSUB_SA_EMAIL ?? '', // expected `email` claim
  },

  // ---- Shopify: ownership match (purchase email) + order webhooks ----
  shopify: {
    shop: process.env.SHOPIFY_SHOP ?? '', // PLACEHOLDER e.g. theglowcompany.myshopify.com
    adminToken: process.env.SHOPIFY_ADMIN_TOKEN ?? '', // PLACEHOLDER
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET ?? '', // PLACEHOLDER
    // product/SKU ids whose purchase grants the premium bundle entitlement
    bundleProductIds: (process.env.SHOPIFY_BUNDLE_PRODUCT_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // ---- Content CDN: signed URLs for audio/video ----
  cdn: {
    baseUrl: process.env.CDN_BASE_URL ?? '', // PLACEHOLDER e.g. https://cdn.theglowcompany.co
    signingKey: process.env.CDN_SIGNING_KEY ?? '', // PLACEHOLDER
    signedUrlTtlSec: parseInt(process.env.CDN_SIGNED_URL_TTL ?? '3600', 10),
  },

  // ---- Push notifications (APNs + FCM) ----
  // ---- transactional mail (password reset / email verification) ----
  // Dev-safe: without SMTP_URL the MailService logs the message instead of sending.
  mail: {
    smtpUrl: process.env.SMTP_URL ?? '', // PLACEHOLDER e.g. smtps://user:pass@smtp.host:465
    from: process.env.MAIL_FROM ?? 'CalmCarry <no-reply@theglowcompany.co>',
  },
  push: {
    apnsKeyId: process.env.APNS_KEY_ID ?? '', // PLACEHOLDER
    apnsTeamId: process.env.APNS_TEAM_ID ?? '', // PLACEHOLDER
    apnsKeyP8: process.env.APNS_KEY_P8 ?? '', // PLACEHOLDER (the .p8 contents)
    apnsTopic: process.env.APNS_TOPIC ?? 'co.theglowcompany.calmcarry', // bundle id
    apnsSandbox: process.env.APNS_SANDBOX === '1', // dev builds use api.sandbox.push.apple.com
    firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '', // PLACEHOLDER (FCM v1)
  },

  // guards the CMS write endpoints (content publishing)
  cmsAdminKey: process.env.CMS_ADMIN_KEY ?? 'dev-cms-key',

  // Auth for the serverless retention-purge cron. Vercel Cron sends
  // `Authorization: Bearer ${CRON_SECRET}`; set this on the Vercel project or the
  // daily COPPA/retention purge will 401 and never run. (Long-lived deploys don't
  // need it - their in-process daily timer runs the purge directly.)
  cronSecret: process.env.CRON_SECRET ?? '',

  // Optional shared store for rate-limit counters across serverless/multi-instance
  // deploys. Unset → per-instance in-memory (limits don't hold across machines).
  redisUrl: process.env.REDIS_URL ?? '',

  // Money-path DEV switches - DEFAULT OFF and INDEPENDENT of NODE_ENV, so an unset
  // or mis-set NODE_ENV can never silently grant premium. Turn ON only for local
  // end-to-end testing without real store credentials.
  allowDevIap: process.env.ALLOW_DEV_IAP === '1', // devGrant a receipt without store creds
  allowSandboxIap: process.env.ALLOW_SANDBOX_IAP === '1', // accept Apple SANDBOX receipts in prod (App Review)

  // product ids whose validated receipt grants the premium subscription. The
  // server NEVER trusts a client/receipt product id outside this allowlist.
  premiumProductIds: (
    process.env.PREMIUM_PRODUCT_IDS ??
    'calmcarry.premium.monthly,calmcarry.premium.annual'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

/** True only in a real production deployment. */
export const isProd = config.nodeEnv === 'production';

/** Which integrations have real credentials. False → DEV-FALLBACK mode. */
export const integrations = {
  appleSignIn: !!config.apple.signInClientId,
  appleIap: !!config.apple.rootCertsDir, // StoreKit 2 validation uses the Apple Root CA certs
  appleRevoke: !!(
    config.apple.signInClientId &&
    config.apple.signInTeamId &&
    config.apple.signInKeyId &&
    config.apple.signInKeyP8
  ),
  googleSignIn: !!config.google.signInClientId,
  googleIap: !!config.google.playServiceAccountJson,
  shopify: !!(config.shopify.shop && config.shopify.adminToken),
  cdn: !!(config.cdn.baseUrl && config.cdn.signingKey),
  push: !!(config.push.firebaseServiceAccountJson || config.push.apnsKeyP8),
  mail: !!config.mail.smtpUrl,
};

/** In dev (no prod keys) we simulate success so the app runs without credentials. */
export const devFallback = config.nodeEnv !== 'production';

/**
 * The production secret-gate. Returns the list of missing/default critical secrets
 * (empty in non-prod). BOTH entrypoints (main.ts and the Vercel serverless function)
 * MUST call this before serving - otherwise prod could silently boot on the public
 * dev JWT secret + dev fallbacks. Pure (no logging/exit) so each caller decides how
 * to fail (main exits the process; serverless throws so the function 500s).
 */
export function prodSecretGaps(): string[] {
  if (!isProd) return [];
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || config.jwtSecret.includes('change-me')) missing.push('JWT_SECRET');
  // Also catch a SET-BUT-EMPTY value: `?? 'dev-cms-key'` does not coalesce '', so a
  // blank Railway variable yields '' and would sail past a literal-only comparison.
  if (!config.cmsAdminKey || config.cmsAdminKey === 'dev-cms-key') missing.push('CMS_ADMIN_KEY');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  // CDN keys are only required once STREAMING is turned on - v1 ships bundled-only
  // audio, and CdnService fail-closes (503) cleanly if hit without keys, which the
  // client catches and falls back to the bundled asset.
  if (process.env.STREAMING_ENABLED === 'true' && (!config.cdn.baseUrl || !config.cdn.signingKey))
    missing.push('CDN_BASE_URL + CDN_SIGNING_KEY');
  if (!config.corsOrigins.length) missing.push('CORS_ORIGINS');
  if (!config.apple.signInClientId && !config.google.signInClientId) missing.push('APPLE_SIGNIN_CLIENT_ID or GOOGLE_SIGNIN_CLIENT_ID');
  if (!integrations.appleIap && !integrations.googleIap) missing.push('APPLE_ROOT_CERTS_DIR or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  // If Apple IAP is active (root certs present), the App Store Server Library's
  // Production verifier THROWS 'appAppleId is required' unless a numeric app id is
  // set - and that throw surfaces only on the first real purchase (returned as a
  // generic 401), while the server otherwise boots green. Require it here so the
  // gap fails LOUDLY at deploy instead of silently charging a user with no unlock.
  if (integrations.appleIap && !(config.apple.appAppleId > 0)) missing.push('APPLE_APP_APPLE_ID');
  return missing;
}

/** True if NODE_ENV is set to an unrecognized value (a typo like "prod"/"staging"
 *  would run every prod guard OFF). Both entrypoints refuse to start on this. */
export function nodeEnvIsInvalid(): boolean {
  const raw = process.env.NODE_ENV;
  return !!raw && !['development', 'test', 'production'].includes(raw);
}
