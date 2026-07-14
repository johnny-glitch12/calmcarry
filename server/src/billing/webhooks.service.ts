import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Environment, NotificationTypeV2, SignedDataVerifier } from '@apple/app-store-server-library';
import { OAuth2Client } from 'google-auth-library';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { config, isProd } from '../config';
import { AnalyticsService } from '../events/analytics.service';
import { UsersService } from '../users/users.service';

/**
 * Store subscription LIFECYCLE handler - App Store Server Notifications V2 and
 * Google Play Real-Time Developer Notifications (RTDN). Without these, an entitlement
 * only changes when the CLIENT posts a receipt, so a cancel/refund/expiry that happens
 * store-side is invisible until the app re-validates (a refunded user keeps premium).
 *
 * AUTHENTICITY is enforced before any state change:
 *  - Apple: the official SignedDataVerifier validates the JWS x5c chain to the Apple
 *    Root CA (operator supplies the root certs via APPLE_ROOT_CERTS_DIR).
 *  - Google: the Pub/Sub push request's OIDC bearer token is verified (signature +
 *    audience + service-account email) before the message is trusted.
 * If verification material is absent, we FAIL CLOSED (503) - never process unverified.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('StoreWebhooks');
  private appleVerifier: SignedDataVerifier | null = null;
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly users: UsersService,
    private readonly analytics: AnalyticsService,
  ) {}

  // Server-authoritative churn signal (§15: subscription churn + cancellation reasons).
  // Fire-and-forget AFTER verification + state change so it can never 503 a valid webhook.
  private recordChurn(reason: 'expired' | 'refund' | 'revoked' | 'user_cancelled'): void {
    void this.analytics.record('subscription_cancelled', null, { reason }).catch(() => {});
  }

  // ---------- Apple ----------
  private loadAppleRootCerts(): Buffer[] {
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

  private getAppleVerifier(): SignedDataVerifier {
    if (this.appleVerifier) return this.appleVerifier;
    const certs = this.loadAppleRootCerts();
    if (!certs.length) {
      throw new ServiceUnavailableException('Apple webhook verification not configured (root certs missing).');
    }
    this.appleVerifier = new SignedDataVerifier(
      certs,
      true, // enable online (OCSP) checks
      isProd ? Environment.PRODUCTION : Environment.SANDBOX,
      config.apple.bundleId,
      config.apple.appAppleId || undefined,
    );
    return this.appleVerifier;
  }

  async handleApple(body: { signedPayload?: string }): Promise<{ ok: boolean; applied: boolean }> {
    if (!body?.signedPayload) throw new BadRequestException('Missing signedPayload');
    const verifier = this.getAppleVerifier(); // 503 if not configured
    let notificationType: string | undefined;
    let ref: string | undefined;
    let expiresAt: Date | undefined;
    try {
      const notification = await verifier.verifyAndDecodeNotification(body.signedPayload);
      notificationType = notification.notificationType;
      const signedTx = notification.data?.signedTransactionInfo;
      if (signedTx) {
        const tx = await verifier.verifyAndDecodeTransaction(signedTx);
        ref = tx.originalTransactionId;
        expiresAt = tx.expiresDate ? new Date(tx.expiresDate) : undefined;
      }
    } catch {
      throw new BadRequestException('Apple notification failed verification');
    }
    if (!ref || !notificationType) return { ok: true, applied: false };

    let applied = false;
    switch (notificationType) {
      case NotificationTypeV2.SUBSCRIBED:
      case NotificationTypeV2.DID_RENEW:
      case NotificationTypeV2.OFFER_REDEEMED:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'active', expiresAt });
        break;
      case NotificationTypeV2.EXPIRED:
      case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'expired' });
        this.recordChurn('expired');
        break;
      case NotificationTypeV2.REFUND:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'revoked' });
        this.recordChurn('refund');
        break;
      case NotificationTypeV2.REVOKE:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'revoked' });
        this.recordChurn('revoked');
        break;
      default:
        break; // DID_CHANGE_RENEWAL_STATUS etc. leave the current term intact
    }
    this.logger.log(`apple ${notificationType} ref=${ref} applied=${applied}`);
    return { ok: true, applied };
  }

  // ---------- Google ----------
  private async verifyPubSubToken(authHeader?: string): Promise<void> {
    const aud = config.google.pubsubAudience;
    if (!aud) {
      throw new ServiceUnavailableException('Google webhook verification not configured (pubsub audience missing).');
    }
    const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new BadRequestException('Missing Pub/Sub OIDC token');
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken: token, audience: aud });
      const payload = ticket.getPayload();
      const expectedEmail = config.google.pubsubServiceAccountEmail;
      if (!payload || (expectedEmail && payload.email !== expectedEmail) || payload.email_verified === false) {
        throw new Error('bad claims');
      }
    } catch {
      throw new BadRequestException('Pub/Sub OIDC verification failed');
    }
  }

  async handleGoogle(
    body: { message?: { data?: string } },
    authHeader?: string,
  ): Promise<{ ok: boolean; applied: boolean }> {
    await this.verifyPubSubToken(authHeader); // 503 if not configured, 400 if invalid
    const data = body?.message?.data;
    if (!data) return { ok: true, applied: false };
    let notif: { subscriptionNotification?: { notificationType?: number; purchaseToken?: string } } | null = null;
    try {
      notif = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed Pub/Sub message');
    }
    const sub = notif?.subscriptionNotification;
    const ref = sub?.purchaseToken;
    if (!sub?.notificationType || !ref) return { ok: true, applied: false };

    // Play type: 2 RENEWED, 4 PURCHASED, 7 RESTARTED, 12 REVOKED, 13 EXPIRED
    let applied = false;
    switch (sub.notificationType) {
      case 2:
      case 4:
      case 7:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'active' });
        break;
      case 13:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'expired' });
        this.recordChurn('expired');
        break;
      case 12:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'revoked' });
        this.recordChurn('revoked');
        break;
      case 3:
        // CANCELED - auto-renew turned off; term stays active until it lapses, but
        // record the cancellation intent so churn/cancellation reasons are visible.
        this.recordChurn('user_cancelled');
        break;
      default:
        break; // 5 ON_HOLD / 6 IN_GRACE leave the term active until it lapses
    }
    this.logger.log(`google type=${sub.notificationType} ref=${ref} applied=${applied}`);
    return { ok: true, applied };
  }
}
