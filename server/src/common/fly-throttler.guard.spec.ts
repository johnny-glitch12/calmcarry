import { FlyThrottlerGuard } from './fly-throttler.guard';

// getTracker decides whose bucket a request lands in - behind Fly's proxy this
// MUST be the real client IP (Fly-Client-IP), never the shared socket address.
describe('FlyThrottlerGuard.getTracker', () => {
  const guard = Object.create(FlyThrottlerGuard.prototype) as FlyThrottlerGuard;
  const track = (req: Record<string, unknown>) =>
    (guard as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }).getTracker(req);

  it('keys on Fly-Client-IP when present', async () => {
    await expect(track({ headers: { 'fly-client-ip': '203.0.113.7' }, ip: '172.16.0.1' })).resolves.toBe(
      '203.0.113.7',
    );
  });

  it('two distinct clients behind the proxy get distinct buckets', async () => {
    const a = await track({ headers: { 'fly-client-ip': '203.0.113.7' }, ip: '172.16.0.1' });
    const b = await track({ headers: { 'fly-client-ip': '198.51.100.9' }, ip: '172.16.0.1' });
    expect(a).not.toBe(b);
  });

  it('falls back to the socket address in local dev (no Fly header)', async () => {
    await expect(track({ headers: {}, ip: '127.0.0.1' })).resolves.toBe('127.0.0.1');
  });

  it('handles array header values and missing everything', async () => {
    await expect(track({ headers: { 'fly-client-ip': ['203.0.113.7'] } })).resolves.toBe('203.0.113.7');
    await expect(track({})).resolves.toBe('unknown');
  });
});
