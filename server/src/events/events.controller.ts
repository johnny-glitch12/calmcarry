import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import * as crypto from 'crypto';
import { config } from '../config';
import { AnalyticsService } from './analytics.service';

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

  @IsOptional()
  @IsString()
  @MaxLength(40)
  at?: string;
}

class TrackBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  anonId?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}

/** Constant-time compare so the admin key can't be recovered via timing. */
function safeKeyEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a ?? '');
  const bb = Buffer.from(b ?? '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * First-party analytics intake (build plan §15). Writes are public + anonymous (no
 * auth, no PII) — the client posts funnel events keyed by an install id. The funnel
 * readout is admin-only (CMS key header).
 */
@Controller('events')
export class EventsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // Tight per-IP cap on these public, unauthenticated writes (defends against
  // storage-exhaustion / write-amplification beyond the generous global throttle).
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async track(@Body() dto: TrackEventDto) {
    await this.analytics.record(dto.name, dto.anonId ?? null, dto.props ?? null);
    return { ok: true };
  }

  @Post('batch')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async trackBatch(@Body() dto: TrackBatchDto) {
    const accepted = await this.analytics.recordBatch(dto.anonId ?? null, dto.events ?? []);
    return { ok: true, accepted };
  }

  // Admin-only funnel readout — guarded by the CMS key header (same pattern as the
  // CMS content write). Not rate-limited tight so the dashboard can poll it.
  @Get('funnel')
  async funnel(@Headers('x-cms-key') key: string) {
    if (!safeKeyEqual(key, config.cmsAdminKey)) throw new UnauthorizedException('Bad CMS key');
    return this.analytics.funnel();
  }
}
