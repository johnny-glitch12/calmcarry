import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentItem, Program } from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContentItem, Program])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
