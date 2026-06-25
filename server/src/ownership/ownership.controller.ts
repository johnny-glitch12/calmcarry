import { Controller, Headers, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { ShopifyService } from '../integrations/shopify.service';

/**
 * Device OWNERSHIP — separate from premium entitlement (build plan §8). Matches a
 * Shopify order by purchase email to grant the owner badge + warranty. Never
 * required for app entry, and never grants premium (that's the IAP subscription).
 */
@Controller()
export class OwnershipController {
  constructor(private readonly shopify: ShopifyService) {}

  @Post('ownership/match')
  @UseGuards(JwtAuthGuard)
  async match(@CurrentUser() user: JwtPayload) {
    // Match ONLY the authenticated account's own email — never a client-supplied
    // address (which would be an ownership oracle / badge-spoof vector).
    const email = (user.email ?? '').trim();
    const m = await this.shopify.matchByEmail(email);
    return { verifiedOwner: m.owns, ownsBundle: m.ownsBundle, orderId: m.orderId };
  }

  /** Shopify orders/create webhook (HMAC-verified). Production: sync ownership/warranty. */
  @Post('webhooks/shopify/orders')
  async orderWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-shopify-hmac-sha256') hmac: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify((req as { body?: unknown }).body ?? {}));
    // Reject forged webhooks with 401 (not a 200) so unverified callers can't probe.
    if (!this.shopify.verifyWebhook(raw, hmac)) throw new UnauthorizedException('Invalid webhook signature');
    return { ok: true };
  }
}
