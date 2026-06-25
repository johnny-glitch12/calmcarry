import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CommunityPost,
  ContentItem,
  Device,
  Entitlement,
  Owner,
  Profile,
  Program,
} from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Owner,
      Entitlement,
      Device,
      ContentItem,
      Program,
      Profile,
      CommunityPost,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
