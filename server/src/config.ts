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
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  // file-based SQLite by default; set DATABASE_URL (Postgres) in production
  dbPath: process.env.DB_PATH ?? join(process.cwd(), 'data', 'calmcarry.sqlite'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: (process.env.DATABASE_SSL ?? 'true') !== 'false', // most hosted PG needs SSL
  // allow a one-time schema bootstrap on a fresh prod DB (set DB_SYNC=true), else off
  dbSync: process.env.DB_SYNC === 'true',
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
  push: {
    fcmServerKey: process.env.FCM_SERVER_KEY ?? '', // PLACEHOLDER
    apnsKeyId: process.env.APNS_KEY_ID ?? '', // PLACEHOLDER
    apnsTeamId: process.env.APNS_TEAM_ID ?? '', // PLACEHOLDER
    apnsKeyP8: process.env.APNS_KEY_P8 ?? '', // PLACEHOLDER (the .p8 contents)
  },

  // guards the CMS write endpoints (content publishing)
  cmsAdminKey: process.env.CMS_ADMIN_KEY ?? 'dev-cms-key',

  // Optional shared store for rate-limit counters across serverless/multi-instance
  // deploys. Unset → per-instance in-memory (limits don't hold across machines).
  redisUrl: process.env.REDIS_URL ?? '',

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
  push: !!(config.push.fcmServerKey || config.push.apnsKeyP8),
};

/** In dev (no prod keys) we simulate success so the app runs without credentials. */
export const devFallback = config.nodeEnv !== 'production';
