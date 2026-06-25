import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

/**
 * Store subscription LIFECYCLE handler — App Store Server Notifications V2 and
 * Google Play Real-Time Developer Notifications (RTDN).
 *
 * Without this, an entitlement only ever changes when the CLIENT posts a receipt
 * to /billing/validate, so a renewal, cancellation, refund or expiry that happens
 * store-side is invisible until the app happens to re-validate — a refunded user
 * could keep premium for a full billing period. These webhooks let the store push
 * those state changes to us, keyed on the renewal ref (Apple originalTransactionId
 * / Google purchaseToken) we already store on the entitlement.
 *
 * AUTHENTICITY: a webhook that grants/revokes premium MUST be authenticated, or
 * anyone could forge one. Apple V2 payloads are JWS-signed (verify the x5c chain to
 * the Apple Root CA); Play RTDN arrives via Pub/Sub push (verify the OIDC token
 * audience). That verification material isn't wired yet, so — exactly like
 * receipt-validation — we FAIL CLOSED in production and only decode-without-verify
 * in development. Implement verifyApple()/verifyGoogle() before enabling in prod.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('StoreWebhooks');

  constructor(private readonly users: UsersService) {}

  private assertAuthentic(source: 'apple' | 'google'): void {
    // Verification (Apple JWS x5c chain to the Apple Root CA / Play Pub/Sub OIDC
    // token) is NOT implemented, so a notification's contents are unauthenticated
    // and forgeable. FAIL CLOSED in EVERY environment — never log-and-continue, and
    // never gate this on NODE_ENV (an unset/typo'd env must not open it). When
    // verification ships, run it here and only then allow the event through.
    throw new ServiceUnavailableException(`${source} webhook verification not configured`);
  }

  /** Decode a JWS compact serialization's payload segment (no verification). */
  private decodeJws<T>(jws: string): T | null {
    try {
      const payload = jws.split('.')[1];
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
    } catch {
      return null;
    }
  }

  /** App Store Server Notifications V2 — body: { signedPayload }. */
  async handleApple(body: { signedPayload?: string }): Promise<{ ok: boolean; applied: boolean }> {
    this.assertAuthentic('apple');
    if (!body?.signedPayload) return { ok: false, applied: false };
    const payload = this.decodeJws<{
      notificationType?: string;
      subtype?: string;
      data?: { signedTransactionInfo?: string };
    }>(body.signedPayload);
    const tx = payload?.data?.signedTransactionInfo
      ? this.decodeJws<{ originalTransactionId?: string; expiresDate?: number }>(payload.data.signedTransactionInfo)
      : null;
    const ref = tx?.originalTransactionId;
    if (!payload?.notificationType || !ref) return { ok: true, applied: false };

    const expiresAt = tx?.expiresDate ? new Date(tx.expiresDate) : undefined;
    let applied = false;
    switch (payload.notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
      case 'OFFER_REDEEMED':
      case 'DID_CHANGE_RENEWAL_PREF':
        applied = await this.users.applySubscriptionEvent(ref, { status: 'active', expiresAt });
        break;
      case 'EXPIRED':
      case 'GRACE_PERIOD_EXPIRED':
        applied = await this.users.applySubscriptionEvent(ref, { status: 'expired' });
        break;
      case 'REFUND':
      case 'REVOKE':
        applied = await this.users.applySubscriptionEvent(ref, { status: 'revoked' });
        break;
      // DID_CHANGE_RENEWAL_STATUS (auto-renew toggled) leaves the current term intact.
      default:
        break;
    }
    this.logger.log(`apple ${payload.notificationType}/${payload.subtype ?? '-'} ref=${ref} applied=${applied}`);
    return { ok: true, applied };
  }

  /** Google Play RTDN (Pub/Sub push) — body: { message: { data: base64 } }. */
  async handleGoogle(body: { message?: { data?: string } }): Promise<{ ok: boolean; applied: boolean }> {
    this.assertAuthentic('google');
    const data = body?.message?.data;
    if (!data) return { ok: true, applied: false };
    let notif: { subscriptionNotification?: { notificationType?: number; purchaseToken?: string } } | null = null;
    try {
      notif = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    } catch {
      return { ok: false, applied: false };
    }
    const sub = notif?.subscriptionNotification;
    const ref = sub?.purchaseToken;
    if (!sub?.notificationType || !ref) return { ok: true, applied: false };

    // Play notificationType: 2 RENEWED, 3 CANCELED, 4 PURCHASED, 7 RESTARTED,
    // 12 REVOKED, 13 EXPIRED. (Expiry timestamp requires a Play API lookup — left
    // to the receipt-validation path; here we move status.)
    let applied = false;
    switch (sub.notificationType) {
      case 2:
      case 4:
      case 7:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'active' });
        break;
      case 13:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'expired' });
        break;
      case 12:
        applied = await this.users.applySubscriptionEvent(ref, { status: 'revoked' });
        break;
      // 3 CANCELED / 5 ON_HOLD / 6 IN_GRACE leave the current term active until it lapses.
      default:
        break;
    }
    this.logger.log(`google type=${sub.notificationType} ref=${ref} applied=${applied}`);
    return { ok: true, applied };
  }
}
