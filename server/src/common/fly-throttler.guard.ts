import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler tracker for Fly.io. Behind Fly's proxy every request's socket address
 * is the proxy, so the default tracker would put ALL clients in one rate-limit
 * bucket (one busy user could starve everyone). Fly sets `Fly-Client-IP` on every
 * request at the edge (it cannot be spoofed from outside — Fly overwrites it), so
 * we key buckets on that, falling back to the socket address for local dev.
 * Deliberately NOT `app.set('trust proxy', true)`: blanket-trusting
 * X-Forwarded-For would let clients forge their bucket key.
 */
@Injectable()
export class FlyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const flyIp = headers['fly-client-ip'];
    if (typeof flyIp === 'string' && flyIp.length > 0) return flyIp;
    if (Array.isArray(flyIp) && flyIp[0]) return flyIp[0];
    return (req.ip as string) ?? 'unknown';
  }
}
