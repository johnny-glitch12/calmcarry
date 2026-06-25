import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../entities';

// Keep the public, unauthenticated analytics blob small so it can't be used for
// storage-exhaustion writes.
const MAX_PROPS_BYTES = 2048;

class TrackEventDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  anonId?: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;
}

/**
 * First-party analytics intake (build plan §15). Public + anonymous (no auth, no
 * PII) — the client posts funnel events keyed by an install id. Fire-and-forget.
 */
@Controller('events')
// Tight per-IP cap on this public, unauthenticated write endpoint (defends against
// storage-exhaustion / write-amplification beyond the generous global throttle).
@Throttle({ default: { ttl: 60_000, limit: 30 } })
export class EventsController {
  constructor(
    @InjectRepository(AnalyticsEvent) private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  @Post()
  async track(@Body() dto: TrackEventDto) {
    if (dto.props && JSON.stringify(dto.props).length > MAX_PROPS_BYTES) {
      throw new BadRequestException('props too large');
    }
    await this.repo.save(
      this.repo.create({ name: dto.name, anonId: dto.anonId ?? null, props: dto.props ?? null }),
    );
    return { ok: true };
  }
}
