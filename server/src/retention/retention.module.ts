import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent, SessionLog } from '../entities';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent, SessionLog])],
  controllers: [RetentionController],
  providers: [RetentionService],
})
export class RetentionModule {}
