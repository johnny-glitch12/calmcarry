import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

/**
 * getTracker decides whose bucket a request lands in. It MUST derive that from
 * Express's resolved req.ip (correct because main.ts sets `trust proxy` to 1) and
 * MUST NOT trust any raw request header.
 *
 * REGRESSION GUARD: the previous implementation preferred a `Fly-Client-IP` header
 * and the previous version of this file asserted that behaviour was CORRECT, which
 * is exactly why the bypass survived a green suite. An attacker who can choose the
 * bucket key has no rate limit at all.
 */
describe('ClientIpThrottlerGuard.getTracker', () => {
  const guard = Object.create(ClientIpThrottlerGuard.prototype) as ClientIpThrottlerGuard;
  const track = (req: Record<string, unknown>) =>
    (guard as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }).getTracker(req);

  it('keys on the Express-resolved req.ip', async () => {
    await expect(track({ headers: {}, ip: '203.0.113.7' })).resolves.toBe('203.0.113.7');
  });

  it('IGNORES a spoofed Fly-Client-IP header (the old bypass)', async () => {
    // Same real IP, attacker-chosen header: must land in ONE bucket, not two.
    const a = await track({ headers: { 'fly-client-ip': '1.1.1.1' }, ip: '203.0.113.7' });
    const b = await track({ headers: { 'fly-client-ip': '2.2.2.2' }, ip: '203.0.113.7' });
    expect(a).toBe('203.0.113.7');
    expect(b).toBe('203.0.113.7');
    expect(a).toBe(b); // rotating the header must NOT mint a fresh quota
  });

  it('IGNORES a spoofed X-Forwarded-For header (Express applies trust proxy, not us)', async () => {
    const a = await track({ headers: { 'x-forwarded-for': '9.9.9.9' }, ip: '203.0.113.7' });
    const b = await track({ headers: { 'x-forwarded-for': '8.8.8.8' }, ip: '203.0.113.7' });
    expect(a).toBe(b);
    expect(a).toBe('203.0.113.7');
  });

  it('gives two genuinely different clients different buckets', async () => {
    const a = await track({ headers: {}, ip: '203.0.113.7' });
    const b = await track({ headers: {}, ip: '198.51.100.9' });
    expect(a).not.toBe(b);
  });

  it('falls back to a single bucket when no IP can be resolved', async () => {
    await expect(track({})).resolves.toBe('unknown');
    await expect(track({ headers: {}, ip: '' })).resolves.toBe('unknown');
  });
});
