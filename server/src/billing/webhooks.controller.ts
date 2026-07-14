import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';

/**
 * Public store-callback endpoints (no JWT - the caller is Apple/Google, not a user).
 * A generous-but-finite per-IP cap absorbs legitimate renewal bursts while denying an
 * unauthenticated flood; authenticity is enforced inside the service (WebhooksService).
 */
@Controller('webhooks')
@Throttle({ default: { ttl: 60_000, limit: 120 } })
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('apple')
  @HttpCode(200)
  apple(@Body() body: { signedPayload?: string }) {
    return this.webhooks.handleApple(body);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body() body: { message?: { data?: string } }, @Headers('authorization') auth?: string) {
    return this.webhooks.handleGoogle(body, auth);
  }
}
