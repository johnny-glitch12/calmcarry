import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushToken } from '../entities';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushToken]), JwtModule.register({ secret: config.jwtSecret })],
  controllers: [NotificationsController],
  providers: [NotificationsService, JwtAuthGuard],
})
export class NotificationsModule {}
