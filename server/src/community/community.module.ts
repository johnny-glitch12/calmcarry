import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from '../config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityPost } from '../entities';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityPost]), JwtModule.register({ secret: config.jwtSecret })],
  controllers: [CommunityController],
  providers: [CommunityService, JwtAuthGuard],
})
export class CommunityModule {}
