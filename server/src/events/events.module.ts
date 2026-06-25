import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from '../entities';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [EventsController],
})
export class EventsModule {}
