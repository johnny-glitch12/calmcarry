import { Controller, Get, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

/** Liveness + readiness probe (for the host's health checks + uptime monitoring). */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(@Req() req: Request) {
    let db = false;
    try {
      await this.dataSource.query('SELECT 1');
      db = true;
    } catch {
      db = false;
    }
    // Rate-limit buckets are keyed on req.ip, so whether the proxy chain resolves a
    // STABLE per-client value decides whether the throttle works at all. Deploying a
    // throttle fix without being able to see this is how a bypass survived: the
    // limiter looked correctly wired while every request landed in its own bucket.
    // Echoes only the caller's own address back to that caller (nothing they do not
    // already know) plus the hop count - no header contents, no secrets.
    const xff = req.headers['x-forwarded-for'];
    const xffList = (Array.isArray(xff) ? xff.join(',') : xff ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      ok: db,
      db: db ? 'up' : 'down',
      uptimeSec: Math.round(process.uptime()),
      // Ops probe for the proxy chain. Rate-limit buckets key on the resolved client
      // address, so if `ip` here ever stops matching the caller's real address (or
      // starts changing between calls), the limiter is silently dead again - which is
      // exactly how a bypass survived two "fixes". Echoes only the caller's own
      // address back to that caller plus the hop count: no header contents, no
      // internal topology, no secrets.
      net: {
        ip: req.ip ?? null,
        hops: xffList.length,
        trustProxy: req.app?.get('trust proxy') ?? null,
      },
    };
  }
}
