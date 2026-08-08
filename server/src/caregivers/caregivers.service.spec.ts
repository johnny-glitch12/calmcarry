import { BadRequestException } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { CaregiversService } from './caregivers.service';

/**
 * Invite capacity must be counted from codes that could still be REDEEMED.
 *
 * The cap exists so one subscription cannot be resold to unlimited accounts. It used
 * to count every unredeemed invite regardless of age, which meant a household that
 * sent five codes nobody used was locked out of inviting forever: the codes expired
 * after 7 days, became permanently unredeemable, and still occupied all five slots.
 * No caregivers, no usable codes, no way to make one.
 */
function harness(opts: { links?: number; outstanding?: number; isCaregiver?: boolean } = {}) {
  type CountArgs = { where: { householdOwnerId: string; redeemedByOwnerId: unknown; expiresAt?: unknown } };
  const inviteCount = jest.fn(async (_args: CountArgs) => opts.outstanding ?? 0);
  const saved: unknown[] = [];
  const links = {
    findOne: jest.fn(async () => (opts.isCaregiver ? { id: 'l1' } : null)),
    count: jest.fn(async () => opts.links ?? 0),
  };
  const invites = {
    count: inviteCount,
    // When there are outstanding codes, createInvite hands back the newest existing one
    // rather than minting another. Return a stub only when outstanding > 0.
    findOne: jest.fn(async () =>
      (opts.outstanding ?? 0) > 0
        ? { code: 'EXIST-ING-CODE', expiresAt: new Date(Date.now() + 7 * 86_400_000) }
        : null,
    ),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => {
      saved.push(x);
      return x;
    }),
  };
  const svc = new CaregiversService(invites as never, links as never, {} as never, {} as never);
  return { svc, invites, links, inviteCount, saved };
}

describe('CaregiversService.createInvite - capacity', () => {
  it('issues a code when the household has room', async () => {
    // POSITIVE CONTROL: without this, a rejection test could pass for any reason.
    const { svc, saved } = harness({ links: 0, outstanding: 0 });
    const out = await svc.createInvite('owner-1');
    expect(out.code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(saved).toHaveLength(1);
  });

  it('THE BUG: only UNEXPIRED invites are counted against the cap', async () => {
    const { svc, inviteCount } = harness();
    await svc.createInvite('owner-1');

    // the count must be constrained to codes that have not expired - otherwise five
    // dead codes brick the household permanently
    expect(inviteCount).toHaveBeenCalledWith({
      where: { householdOwnerId: 'owner-1', redeemedByOwnerId: IsNull(), expiresAt: expect.any(Object) },
    });
    const arg = inviteCount.mock.calls[0][0];
    expect(arg.where.expiresAt).toEqual(MoreThan(expect.any(Date)));
  });

  it('a household whose five codes all expired can invite again', async () => {
    // the repo now filters them out, so the service sees 0 outstanding
    const { svc, saved } = harness({ links: 0, outstanding: 0 });
    await expect(svc.createInvite('owner-1')).resolves.toBeDefined();
    expect(saved).toHaveLength(1);
  });

  it('at capacity WITH an outstanding code, hands back the existing code instead of erroring', async () => {
    // returning a code the household already made mints no new capacity, so it is
    // safe at the cap - and far better UX than "limit reached" when they just want to
    // re-see their code. Only a cap reached with NO reusable code should refuse.
    const { svc, saved } = harness({ links: 2, outstanding: 3 });
    const out = await svc.createInvite('owner-1');
    expect(out.code).toBe('EXIST-ING-CODE');
    expect(saved).toHaveLength(0); // reused, nothing new saved
  });

  it('refuses a NEW code when the cap is full of real members and no code exists to reuse', async () => {
    const { svc } = harness({ links: 5, outstanding: 0 });
    await expect(svc.createInvite('owner-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still refuses when the household is full of real members', async () => {
    const { svc } = harness({ links: 5, outstanding: 0 });
    await expect(svc.createInvite('owner-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a caregiver cannot invite', async () => {
    const { svc } = harness({ isCaregiver: true });
    await expect(svc.createInvite('caregiver-1')).rejects.toThrow(/household owner/i);
  });

  it('codes are not predictable between calls', async () => {
    const { svc } = harness();
    const a = await svc.createInvite('owner-1');
    const b = await svc.createInvite('owner-1');
    expect(a.code).not.toBe(b.code);
  });
});
