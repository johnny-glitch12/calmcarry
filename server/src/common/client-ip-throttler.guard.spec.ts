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

  it('keys on the edge-set x-real-ip when present (the production path)', async () => {
    // Railway sets x-real-ip to the true client and OVERWRITES any client-supplied
    // value (spoof-tested against prod), so it is the most stable per-client key.
    await expect(track({ headers: { 'x-real-ip': '2.51.77.139' }, ip: '152.233.13.165' })).resolves.toBe(
      '2.51.77.139',
    );
  });

  it('does NOT bucket on the rotating edge address when x-real-ip is present', async () => {
    // THE PRODUCTION BUG: req.ip was the edge, which rotates per request, so every
    // request got a fresh bucket and 25 failed logins produced zero 429s.
    const a = await track({ headers: { 'x-real-ip': '2.51.77.139' }, ip: '152.233.13.165' });
    const b = await track({ headers: { 'x-real-ip': '2.51.77.139' }, ip: '152.233.12.242' });
    const c = await track({ headers: { 'x-real-ip': '2.51.77.139' }, ip: '152.233.12.245' });
    expect(new Set([a, b, c]).size).toBe(1); // one client => ONE bucket
  });

  it('falls back to req.ip when there is no x-real-ip', async () => {
    await expect(track({ headers: {}, ip: '203.0.113.7' })).resolves.toBe('203.0.113.7');
  });

  it('IGNORES a Fly-Client-IP header (the original client-controlled bypass)', async () => {
    // Railway never sets this, so it was fully attacker-chosen: rotating it minted a
    // fresh quota per request. It must have no influence at all now.
    const a = await track({ headers: { 'fly-client-ip': '1.1.1.1' }, ip: '203.0.113.7' });
    const b = await track({ headers: { 'fly-client-ip': '2.2.2.2' }, ip: '203.0.113.7' });
    expect(a).toBe('203.0.113.7');
    expect(b).toBe('203.0.113.7');
    expect(a).toBe(b);
  });

  it('IGNORES a raw X-Forwarded-For (Express applies trust proxy, we never parse it)', async () => {
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
