import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { GoogleAuth } from 'google-auth-library';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { config, integrations, isProd } from '../config';
import type { EntitlementPlan } from '../entities';

export type Store = 'apple' | 'google';

export interface ValidatedSubscription {
  valid: boolean;
  plan: EntitlementPlan;
  productId: string;
  /** The STABLE renewal key the store's notifications arrive with (Apple
   *  originalTransactionId / Google purchaseToken) - never a per-charge order id,
   *  or webhooks can't find the entitlement they're meant to update. */
  transactionRef: string;
  /** Per-charge store order id, kept for support/audit only. Never a lookup key. */
  sourceOrderId?: string | null;
  expiresAt: Date;
}

/**
 * Validates a purchase server-side and returns the normalized subscription.
 *
 *  - Apple: StoreKit 2. The client sends the JWS signed transaction (purchaseToken);
 *    we verify it with the App Store Server API verifier (the same x5c-chain
 *    verification used for webhooks) - NOT the deprecated /verifyReceipt endpoint.
 *    Needs the Apple Root CA certs (APPLE_ROOT_CERTS_DIR), shared with webhooks.
 *  - Google: Play Billing. We call androidpublisher v3 purchases.subscriptions
 *    authenticated with the Play service account (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON).
 *
 * Without credentials it FAILS CLOSED in production and hands back a dev grant in
 * dev so the purchase flow is exercisable end-to-end.
 */
@Injectable()
export class ReceiptValidationService {
  private readonly logger = new Logger('ReceiptValidation');
  private appleVerifiers: Partial<Record<'prod' | 'sandbox', SignedDataVerifier>> = {};
  private googleAuth: GoogleAuth | null = null;

  async validate(store: Store, receipt: string, productId?: string): Promise<ValidatedSubscription> {
    if (store === 'apple') return this.apple(receipt, productId);
    if (store === 'google') return this.google(receipt, productId);
    throw new BadRequestException('Unknown store');
  }

  private planFor(productId?: string): EntitlementPlan {
    if (!productId) return 'monthly';
    return /annual|year/i.test(productId) ? 'annual' : 'monthly';
  }

  private devGrant(productId?: string): ValidatedSubscription {
    const plan = this.planFor(productId);
    const days = plan === 'annual' ? 365 : 30;
    this.logger.warn(`IAP keys absent → DEV grant (${plan}). Set store creds for real validation.`);
    return {
      valid: true,
      plan,
      productId: productId ?? `calmcarry.premium.${plan}`,
      transactionRef: `dev-${Date.now()}`,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    };
  }

  private assertPremiumSku(sku?: string): void {
    const allow = config.premiumProductIds;
    if (!allow.length) return; // no allowlist configured (dev) → skip
    // REQUIRE a known premium SKU. A missing/undefined productId must NOT grant
    // premium - otherwise a verified transaction with no product silently bypasses
    // the allowlist (money-path hole).
    if (!sku || !allow.includes(sku)) {
      throw new UnauthorizedException('Receipt product is not a premium subscription');
    }
  }

  // ---------- Apple (StoreKit 2 / App Store Server API) ----------
  private appleRootCerts(): Buffer[] {
    const dir = config.apple.rootCertsDir;
    if (!dir) return [];
    try {
      return readdirSync(dir)
        .filter((f) => /\.(cer|pem|der|crt)$/i.test(f))
        .map((f) => readFileSync(join(dir, f)));
    } catch {
      return [];
    }
  }

  private appleVerifier(env: 'prod' | 'sandbox'): SignedDataVerifier {
    const cached = this.appleVerifiers[env];
    if (cached) return cached;
    const certs = this.appleRootCerts();
    if (!certs.length) {
      throw new ServiceUnavailableException('Apple IAP verification not configured (root certs missing)');
    }
    const verifier = new SignedDataVerifier(
      certs,
      true, // online (OCSP) checks
      env === 'prod' ? Environment.PRODUCTION : Environment.SANDBOX,
      config.apple.bundleId,
      config.apple.appAppleId || undefined,
    );
    this.appleVerifiers[env] = verifier;
    return verifier;
  }

  private async apple(receipt: string, productId?: string): Promise<ValidatedSubscription> {
    if (!config.apple.rootCertsDir) {
      // FAIL CLOSED unless dev-IAP is EXPLICITLY enabled. Gating on an opt-in flag
      // (not NODE_ENV) means an unset/mis-set NODE_ENV can never mint a free grant.
      if (!config.allowDevIap) throw new ServiceUnavailableException('IAP not configured');
      this.assertPremiumSku(productId); // even the dev grant must be a real premium SKU
      return this.devGrant(productId);
    }
    if (!receipt) throw new BadRequestException('Missing transaction');
    // Environment order. In prod we accept PRODUCTION receipts only; a real paid
    // purchase can't be sandbox-signed, and accepting sandbox in prod = free premium
    // for anyone with a sandbox account. Sandbox is enabled in prod ONLY behind an
    // explicit flag (App Review tests sandbox against prod builds).
    const order: ('prod' | 'sandbox')[] = isProd
      ? config.allowSandboxIap
        ? ['prod', 'sandbox']
        : ['prod']
      : ['sandbox', 'prod'];
    let tx: {
      productId?: string;
      originalTransactionId?: string;
      transactionId?: string;
      expiresDate?: number;
      environment?: string;
    } | null = null;
    let lastErr: unknown;
    for (const env of order) {
      try {
        tx = await this.appleVerifier(env).verifyAndDecodeTransaction(receipt);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!tx) {
      this.logger.warn(`Apple transaction verification failed: ${String(lastErr)}`);
      throw new UnauthorizedException('Apple transaction failed verification');
    }
    // Defense in depth: even if a sandbox-signed transaction somehow decoded, never
    // grant premium on a SANDBOX-environment transaction in prod unless explicitly allowed.
    if (isProd && !config.allowSandboxIap && tx.environment === Environment.SANDBOX) {
      this.logger.warn('Rejected a SANDBOX Apple transaction in production.');
      throw new UnauthorizedException('Sandbox receipt rejected in production');
    }
    const sku = tx.productId ?? productId;
    this.assertPremiumSku(sku);
    const plan = this.planFor(sku);
    return {
      valid: true,
      plan,
      productId: sku ?? `calmcarry.premium.${plan}`,
      transactionRef: String(tx.originalTransactionId ?? tx.transactionId ?? `apple-${Date.now()}`),
      expiresAt: tx.expiresDate
        ? new Date(Number(tx.expiresDate))
        : new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86_400_000),
    };
  }

  // ---------- Google Play (androidpublisher v3) ----------
  private async google(purchaseToken: string, productId?: string): Promise<ValidatedSubscription> {
    if (!integrations.googleIap) {
      if (!config.allowDevIap) throw new ServiceUnavailableException('IAP not configured');
      this.assertPremiumSku(productId); // even the dev grant must be a real premium SKU
      return this.devGrant(productId);
    }
    if (!purchaseToken) throw new BadRequestException('Missing purchase token');
    const sku = productId;
    if (!sku) throw new BadRequestException('productId required for Google validation');
    this.assertPremiumSku(sku);

    if (!this.googleAuth) {
      let creds: Record<string, unknown>;
      try {
        creds = JSON.parse(config.google.playServiceAccountJson);
      } catch {
        throw new ServiceUnavailableException('Invalid Google service-account JSON');
      }
      this.googleAuth = new GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
    }

    const pkg = config.google.playPackage;
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}` +
      `/purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}`;
    let data: { expiryTimeMillis?: string; paymentState?: number; orderId?: string };
    try {
      const client = await this.googleAuth.getClient();
      const res = await client.request<typeof data>({ url });
      data = res.data;
    } catch (e) {
      this.logger.warn(`Google purchase verification failed: ${String(e)}`);
      throw new UnauthorizedException('Google purchase failed verification');
    }
    const expiryMs = Number(data?.expiryTimeMillis ?? 0);
    if (!expiryMs) throw new UnauthorizedException('No expiry on Google purchase');
    // paymentState: 0 pending, 1 received, 2 free-trial, 3 deferred. Reject unpaid.
    if (data.paymentState != null && data.paymentState !== 1 && data.paymentState !== 2) {
      throw new UnauthorizedException('Google purchase is not paid');
    }
    return {
      valid: true,
      plan: this.planFor(sku),
      productId: sku,
      // transactionRef MUST be the purchaseToken: it is the stable key that every
      // Real-Time Developer Notification (renew/expire/revoke) is delivered with,
      // and it survives renewals. orderId changes per charge ("GPA.3312-...") and is
      // always present, so keying on it meant EVERY Play notification missed its
      // entitlement: renewals never extended the expiry (a paying subscriber lost
      // premium at the first renewal boundary) and refunds never revoked access.
      transactionRef: purchaseToken,
      sourceOrderId: data.orderId ?? null,
      expiresAt: new Date(expiryMs),
    };
  }
}
