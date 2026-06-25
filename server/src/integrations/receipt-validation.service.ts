import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { config, devFallback, integrations } from '../config';
import type { EntitlementPlan } from '../entities';

export type Store = 'apple' | 'google';

export interface ValidatedSubscription {
  valid: boolean;
  plan: EntitlementPlan;
  productId: string;
  transactionRef: string;
  expiresAt: Date;
}

/**
 * Validates an App Store / Play Billing receipt server-side and returns the
 * normalized subscription. Real validation runs ONLY when credentials exist
 * (config.apple.iapSharedSecret / config.google.playServiceAccountJson); without
 * them it returns a dev grant so the app's purchase flow works end-to-end.
 *
 * PLACEHOLDER: set APPLE_IAP_SHARED_SECRET / GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.
 */
@Injectable()
export class ReceiptValidationService {
  private readonly logger = new Logger('ReceiptValidation');

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
    this.logger.warn(`IAP keys absent → DEV grant (${plan}). Set store secrets for real validation.`);
    return {
      valid: true,
      plan,
      productId: productId ?? `calmcarry.premium.${plan}`,
      transactionRef: `dev-${Date.now()}`,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    };
  }

  private async apple(receipt: string, productId?: string): Promise<ValidatedSubscription> {
    if (!integrations.appleIap) {
      // FAIL CLOSED in production — never hand out premium without real validation
      if (!devFallback) throw new ServiceUnavailableException('IAP not configured');
      return this.devGrant(productId);
    }
    const body = {
      'receipt-data': receipt,
      password: config.apple.iapSharedSecret,
      'exclude-old-transactions': true,
    };
    // production first, then retry sandbox on Apple's 21007 (sandbox receipt sent to prod)
    let json = await this.post(config.apple.verifyUrl, body);
    if (json.status === 21007) json = await this.post(config.apple.verifyUrlSandbox, body);
    if (json.status !== 0) throw new UnauthorizedException(`Apple receipt invalid (status ${json.status})`);
    const info = (json.latest_receipt_info ?? []).sort(
      (a: any, b: any) => Number(b.expires_date_ms) - Number(a.expires_date_ms),
    )[0];
    if (!info) throw new UnauthorizedException('No subscription in receipt');
    // Only our known premium SKUs grant premium — never trust an arbitrary
    // product_id from the receipt blob.
    const allow = config.premiumProductIds;
    if (allow.length && !allow.includes(info.product_id)) {
      throw new UnauthorizedException('Receipt product is not a premium subscription');
    }
    // NOTE: for full account-binding, also verify info.app_account_token matches a
    // token minted for the requesting account at purchase time (prevents receipt reuse).
    return {
      valid: true,
      plan: this.planFor(info.product_id),
      productId: info.product_id,
      transactionRef: info.original_transaction_id,
      expiresAt: new Date(Number(info.expires_date_ms)),
    };
  }

  private async google(purchaseToken: string, productId?: string): Promise<ValidatedSubscription> {
    if (!integrations.googleIap) {
      if (!devFallback) throw new ServiceUnavailableException('IAP not configured');
      return this.devGrant(productId);
    }
    // Real impl: call Android Publisher API
    // GET androidpublisher/v3/applications/{pkg}/purchases/subscriptions/{productId}/tokens/{token}
    // authenticated with the service account (config.google.playServiceAccountJson).
    // Left as a guarded integration point so it never runs without creds.
    throw new BadRequestException(
      'Google Play validation not wired — add a Play Developer API client using GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
    );
  }

  private async post(url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }
}
