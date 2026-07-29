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

// This intake is PUBLIC + unauthenticated, so never trust client props. Whitelist a
// small set of known funnel keys with primitive, length-capped values and DROP
// everything else (no nested objects, no arbitrary/PII fields) - COPPA + storage safety.
const ALLOWED_PROP_KEYS = ['plan', 'category', 'contentId', 'source', 'step', 'variant', 'first', 'completed', 'durationSec', 'reason'];
function sanitizeProps(props?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props || typeof props !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_PROP_KEYS) {
    const v = (props as Record<string, unknown>)[k];
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 80);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    // objects / arrays / anything else are dropped
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Constant-time compare so the admin key can't be recovered via timing.
 * FAILS CLOSED on an empty value on either side - see the twin in
 * content.controller.ts: an unset CMS_ADMIN_KEY ('') plus a missing header would
 * otherwise compare equal and expose the funnel dashboard to anyone.
 */
function safeKeyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * First-party analytics intake (build plan §15). Writes are public + anonymous (no
 * auth, no PII) - the client posts funnel events keyed by an install id. The funnel
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
    await this.analytics.record(dto.name, dto.anonId ?? null, sanitizeProps(dto.props));
    return { ok: true };
  }

  @Post('batch')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async trackBatch(@Body() dto: TrackBatchDto) {
    const events = (dto.events ?? []).map((e) => ({ ...e, props: sanitizeProps(e.props) ?? undefined }));
    const accepted = await this.analytics.recordBatch(dto.anonId ?? null, events);
    return { ok: true, accepted };
  }

  // Admin-only funnel readout - guarded by the CMS key header (same pattern as the
  // CMS content write). Not rate-limited tight so the dashboard can poll it.
  @Get('funnel')
  async funnel(@Headers('x-cms-key') key: string) {
    if (!safeKeyEqual(key, config.cmsAdminKey)) throw new UnauthorizedException('Bad CMS key');
    return this.analytics.funnel();
  }
}
