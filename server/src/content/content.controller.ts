import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import * as crypto from 'crypto';
import { config } from '../config';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';
import { ContentService } from './content.service';

const SLUG = /^[A-Za-z0-9_-]+$/; // ids / keys used in CDN paths must be slug-safe

class RecommendDto {
  @IsString()
  @MaxLength(40)
  intent: string;

  @IsOptional()
  @IsIn(['adult', 'kids'])
  profileType?: string;
}

class UpsertContentDto {
  @Matches(SLUG) @MaxLength(80) id: string;
  @IsString() @MaxLength(40) type: string;
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(40) duration?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) audioKey?: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) coverKey?: string;
  @IsOptional() @IsBoolean() locked?: boolean;
  @IsOptional() @IsBoolean() newThisMonth?: boolean;
}

/** Constant-time compare so the CMS key can't be recovered via timing. */
function safeKeyEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a ?? '');
  const bb = Buffer.from(b ?? '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // Public: the app needs the catalog (with `locked`/`newThisMonth` flags) before sign-in.
  @Get('content')
  getCatalog() {
    return this.content.getCatalog();
  }

  // Signed CDN URL for an item's audio — premium delivery (auth required).
  @Get('content/:id/signed-url')
  @UseGuards(JwtAuthGuard)
  signedUrl(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.content.signedUrl(id, user.sub);
  }

  // Ephemeral forward-looking check-in recommendation (no storage).
  @Post('checkin/recommend')
  recommend(@Body() dto: RecommendDto) {
    return this.content.recommend(dto.intent, dto.profileType);
  }

  // CMS publish — guarded by the CMS admin key header (build plan §11).
  // Constant-time compare + tight throttle to resist key guessing.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('admin/content')
  upsert(@Headers('x-cms-key') key: string, @Body() dto: UpsertContentDto) {
    if (!safeKeyEqual(key, config.cmsAdminKey)) throw new UnauthorizedException('Bad CMS key');
    return this.content.upsert(dto as never);
  }
}
