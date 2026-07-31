import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit tracker keyed on the REAL client IP.
 *
 * MEASURED against production (Railway) on 2026-07-31, because two previous
 * "fixes" shipped on assumptions and left the limiter dead:
 *
 *   GET /health  ->  xff: ["2.51.77.139", "152.233.13.165"]   (real client, then edge)
 *                    x-real-ip: "2.51.77.139"                 (real client)
 *                    req.ip:    "152.233.13.165"  with trust proxy = 1
 *
 * The socket peer is a further internal hop, so `trust proxy = 1` resolved req.ip to
 * Railway's edge address - and that address ROTATES per request (5 distinct values
 * across 8 calls). Every request therefore landed in its own bucket and NO limit
 * could ever trigger: 25 consecutive failed logins returned zero 429s in production.
 *
 * Spoofing was tested, not assumed: a request carrying `X-Forwarded-For: 6.6.6.6`
 * and `X-Real-IP: 6.6.6.6` arrived with BOTH rewritten by the edge (the forged value
 * appeared in neither). So on this host these values are edge-controlled, unlike the
 * old `Fly-Client-IP` branch - which Railway never set, leaving it fully
 * client-controlled and the limiter trivially bypassable by rotating it.
 *
 * Order: x-real-ip (single, edge-set) -> req.ip (correct now that main.ts trusts the
 * measured 2 hops) -> a shared bucket. If this ever moves to a host that does NOT
 * overwrite x-real-ip, that assumption breaks - re-run the spoof test above.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const realIp = headers['x-real-ip'];
    const fromHeader = Array.isArray(realIp) ? realIp[0] : realIp;
    if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader.trim();

    const ip = req.ip;
    return typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';
  }
}
