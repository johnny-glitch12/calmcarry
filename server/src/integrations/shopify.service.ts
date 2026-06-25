import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { config, integrations } from '../config';

export interface OwnershipMatch {
  owns: boolean;
  ownsBundle: boolean; // bought a premium-bundle product → grants entitlement
  orderId: string | null;
}

/**
 * Confirms device ownership (and premium-bundle purchase) against the Shopify
 * store, by purchase email. Real calls run ONLY when SHOPIFY_SHOP +
 * SHOPIFY_ADMIN_TOKEN are set; otherwise a dev stub recognizes the seeded owner.
 *
 * PLACEHOLDER: set SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN, SHOPIFY_BUNDLE_PRODUCT_IDS.
 */
@Injectable()
export class ShopifyService {
  private readonly logger = new Logger('Shopify');

  async matchByEmail(email: string): Promise<OwnershipMatch> {
    if (!integrations.shopify) {
      // dev stub: treat any theglowcompany.co address (incl. the seeded owner) as a bundle owner
      const owns = /@theglowcompany\.co$/i.test(email) || /@glowdermal\.com\.au$/i.test(email);
      this.logger.warn(`Shopify keys absent → dev ownership stub for ${email}: ${owns}`);
      return { owns, ownsBundle: owns, orderId: owns ? `dev-order-${email}` : null };
    }
    const url = `https://${config.shopify.shop}/admin/api/2024-04/orders.json?status=any&email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': config.shopify.adminToken } });
    if (!res.ok) {
      this.logger.error(`Shopify orders lookup failed: ${res.status}`);
      return { owns: false, ownsBundle: false, orderId: null };
    }
    const data = (await res.json()) as { orders?: any[] };
    const orders = data.orders ?? [];
    if (!orders.length) return { owns: false, ownsBundle: false, orderId: null };
    const bundleIds = config.shopify.bundleProductIds;
    const ownsBundle = orders.some((o) =>
      (o.line_items ?? []).some((li: any) =>
        bundleIds.length ? bundleIds.includes(String(li.product_id)) || bundleIds.includes(String(li.variant_id)) : true,
      ),
    );
    return { owns: true, ownsBundle, orderId: String(orders[0].id) };
  }

  /** Verify a Shopify webhook HMAC (orders/create → entitlement). */
  verifyWebhook(rawBody: Buffer, hmacHeader: string): boolean {
    if (!config.shopify.webhookSecret) return config.nodeEnv !== 'production'; // dev: accept
    const digest = crypto.createHmac('sha256', config.shopify.webhookSecret).update(rawBody).digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader ?? ''));
    } catch {
      return false;
    }
  }
}
