import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from '../entities';
import { AnalyticsService } from './analytics.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [EventsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class EventsModule {}
