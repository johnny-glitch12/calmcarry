import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { ReceiptValidationService, Store } from '../integrations/receipt-validation.service';

class ValidateReceiptDto {
  @IsIn(['apple', 'google'])
  store: Store;

  @IsString()
  receipt: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

/** Subscription purchase + status. Receipts are validated server-side (IAP). */
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly receipts: ReceiptValidationService,
    private readonly users: UsersService,
  ) {}

  @Post('validate')
  async validate(@CurrentUser() user: JwtPayload, @Body() dto: ValidateReceiptDto) {
    const v = await this.receipts.validate(dto.store, dto.receipt, dto.productId);
    await this.users.grantSubscription(user.sub, {
      source: dto.store,
      plan: v.plan,
      productId: v.productId,
      transactionRef: v.transactionRef,
      sourceOrderId: v.sourceOrderId ?? null,
      expiresAt: v.expiresAt,
    });
    return this.status(user);
  }

  @Get('status')
  async status(@CurrentUser() user: JwtPayload) {
    const e = await this.users.getEffectiveEntitlement(user.sub);
    const isPremium = this.users.isPremiumEntitlement(e);
    return {
      tier: isPremium ? 'calm_plan' : 'free',
      status: e?.status ?? 'active',
      plan: e?.plan ?? null,
      source: e?.source ?? null,
      expiresAt: e?.expiresAt ?? null,
      isPremium,
    };
  }
}
