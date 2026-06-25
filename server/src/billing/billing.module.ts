import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [UsersModule, JwtModule.register({ secret: config.jwtSecret })],
  controllers: [BillingController, WebhooksController],
  providers: [JwtAuthGuard, WebhooksService],
})
export class BillingModule {}
