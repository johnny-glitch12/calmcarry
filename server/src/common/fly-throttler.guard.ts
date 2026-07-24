import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler tracker for deployments behind an edge proxy. Behind a proxy the raw
 * socket address is the proxy, so the default tracker would put ALL clients in one
 * rate-limit bucket (one busy user could starve everyone, and the per-IP credential
 * throttle would never engage).
 *
 * Resolution order:
 *  1. `Fly-Client-IP` - set by Fly.io at the edge (un-spoofable; Fly overwrites it).
 *  2. `req.ip` - on Railway (and any single-hop PaaS) this is the real client IP,
 *     because main.ts sets `trust proxy` to 1 so Express reads the rightmost
 *     X-Forwarded-For entry the edge appended (a client-forged XFF is ignored).
 *  3. `'unknown'` - last resort so a malformed request still gets a stable bucket.
 *
 * NOTE: this used to fall through to the shared proxy address on Railway (which
 * never sets Fly-Client-IP), silently disabling the throttle - the `trust proxy`
 * setting in main.ts is what makes step 2 correct.
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
