import { Controller, Get, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { config } from '../config';
import { RetentionService } from './retention.service';

/** Constant-time compare. Returns false if EITHER side is empty, so an unset
 *  secret can never be satisfied by an empty/absent credential (no bypass). */
function secretMatches(provided: string, configured: string): boolean {
  if (!configured || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const THROTTLE = { default: { ttl: 60_000, limit: 4 } };

/**
 * Serverless deploys (Vercel functions) are ephemeral, so the in-process daily
 * setInterval in RetentionService never fires reliably. An external scheduler runs
 * the COPPA / data-retention purge by hitting this endpoint daily.
 *
 * Auth - either satisfies, both constant-time, fail-closed:
 *   • Authorization: Bearer <CRON_SECRET>  - Vercel Cron (GET) injects this automatically
 *     when CRON_SECRET is set on the project (see vercel.json `crons`).
 *   • x-cms-key: <CMS_ADMIN_KEY>           - manual / other schedulers (curl, GH Actions; POST).
 *
 * Two explicit verbs (GET for Vercel Cron, POST for manual) rather than @All, to keep
 * PUT/PATCH/DELETE/HEAD/OPTIONS off the attack surface. Rejected hits are logged here
 * because they 401 (a 4xx the global exception filter doesn't log) and a silently
 * mis-keyed cron would otherwise never surface.
 */
@Controller('retention')
export class RetentionController {
  private readonly logger = new Logger('Retention');

  constructor(private readonly retention: RetentionService) {}

  @Get('purge')
  @Throttle(THROTTLE)
  purgeViaCron(
    @Headers('authorization') authHeader?: string,
    @Headers('x-cms-key') cmsKey?: string,
  ): Promise<{ ok: true; purged: number }> {
    return this.run(authHeader, cmsKey);
  }

  @Post('purge')
  @Throttle(THROTTLE)
  purgeManual(
    @Headers('authorization') authHeader?: string,
    @Headers('x-cms-key') cmsKey?: string,
  ): Promise<{ ok: true; purged: number }> {
    return this.run(authHeader, cmsKey);
  }

  private async run(authHeader?: string, cmsKey?: string): Promise<{ ok: true; purged: number }> {
    const bearer = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
    const authorized =
      secretMatches(bearer, config.cronSecret) || secretMatches(cmsKey ?? '', config.cmsAdminKey);
    if (!authorized) {
      // Surfaces a mis-configured cron (e.g. CRON_SECRET unset → Vercel sends no
      // Authorization → 401 every night) which the exception filter wouldn't log.
      this.logger.warn('Rejected /retention/purge - missing or invalid CRON_SECRET / x-cms-key.');
      throw new UnauthorizedException('Unauthorized');
    }
    const purged = await this.retention.purge();
    this.logger.log(`Retention purge ran via endpoint - removed ${purged} record(s).`);
    return { ok: true, purged };
  }
}
