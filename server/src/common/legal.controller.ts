import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PRIVACY_POLICY_HTML } from './privacy-policy.page';

/**
 * Public, unauthenticated legal pages served on our own domain so the app and the
 * App Store listing can point at a URL we control (no dependency on the Shopify
 * storefront). Skip-throttled: these are static documents hit by App Review, users
 * tapping "Privacy Policy", and link previewers.
 */
@SkipThrottle()
@Controller('legal')
export class LegalController {
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  privacy(): string {
    return PRIVACY_POLICY_HTML;
  }
}
