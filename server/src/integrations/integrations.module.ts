import { Global, Module } from '@nestjs/common';
import { CdnService } from './cdn.service';
import { PushService } from './push.service';
import { ReceiptValidationService } from './receipt-validation.service';
import { ShopifyService } from './shopify.service';
import { SocialAuthService } from './social-auth.service';

/** All third-party integration services, each safe to run without credentials. */
@Global()
@Module({
  providers: [ReceiptValidationService, ShopifyService, CdnService, PushService, SocialAuthService],
  exports: [ReceiptValidationService, ShopifyService, CdnService, PushService, SocialAuthService],
})
export class IntegrationsModule {}
