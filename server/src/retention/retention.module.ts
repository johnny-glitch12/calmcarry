import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent, SessionLog } from '../entities';
import { RetentionService } from './retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent, SessionLog])],
  providers: [RetentionService],
})
export class RetentionModule {}
