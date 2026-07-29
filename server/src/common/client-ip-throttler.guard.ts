import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit tracker keyed on the REAL client IP.
 *
 * main.ts sets `trust proxy` to 1, so Express resolves `req.ip` from the single
 * edge-proxy hop in front of the container (Railway today, and the same holds for
 * any one-hop PaaS). Express takes the rightmost X-Forwarded-For entry - the one
 * the edge itself appended - so a client-forged XFF cannot move the bucket.
 *
 * HISTORY - do not "restore" the old behaviour. This guard used to PREFER a
 * `Fly-Client-IP` request header and only fall back to req.ip. A request header is
 * attacker-controlled on any host that does not overwrite it (Railway never sets
 * this one), so rotating it per request gave unlimited login attempts, unlimited
 * password-reset code guesses, and unlimited unauthenticated /events writes - the
 * per-IP throttle was effectively off, verified against production. If this app is
 * ever moved behind Fly, no change is needed: Fly sets X-Forwarded-For too, so
 * req.ip stays correct. Never key a rate-limit bucket on a raw request header.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = req.ip;
    return typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';
  }
}
