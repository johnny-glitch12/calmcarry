import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnershipController } from './ownership.controller';

// ShopifyService comes from the global IntegrationsModule.
@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret })],
  controllers: [OwnershipController],
  providers: [JwtAuthGuard],
})
export class OwnershipModule {}
