import { Entitlement } from '../entities';
import { UsersService } from './users.service';

/**
 * Replay and ordering protection for store subscription webhooks.
 *
 * Apple retries any notification it does not get a 2xx for, and Google Pub/Sub is
 * at-least-once by design. Neither store guarantees order. applySubscriptionEvent
 * used to apply whatever arrived last, so a retried EXPIRED that lost a race with a
 * later DID_RENEW revoked a subscriber who was paying at that moment.
 */
const make = (over: Partial<Entitlement> = {}): Entitlement =>
  ({
    id: 'e1',
    ownerId: 'o1',
    owner: undefined as never,
    tier: 'calm_plan',
    sourceOrderId: null,
    status: 'active',
    source: 'apple',
    plan: 'monthly',
    productId: 'calmcarry.premium.monthly',
    transactionRef: 'txn-1',
    expiresAt: null,
    lastEventAt: null,
    lastEventUid: null,
    grantedAt: new Date(),
    ...over,
  }) as Entitlement;

/** Minimal repo double: one row, saved in place so assertions read the mutated entity. */
function harness(row: Entitlement | null) {
  const saved: Entitlement[] = [];
  const repo = {
    findOne: jest.fn(async () => row),
    save: jest.fn(async (e: Entitlement) => {
      saved.push(e);
      return e;
    }),
  };
  const svc = new UsersService(null as never, repo as never, null as never, null as never);
  return { svc, repo, saved };
}

describe('applySubscriptionEvent - replay and ordering', () => {
  it('applies a normal event and stamps the store identity', async () => {
    // POSITIVE CONTROL: if this fails, every rejection below could be rejecting for
    // the wrong reason and the tests would still pass.
    const row = make();
    const { svc, saved } = harness(row);
    const at = new Date('2026-08-01T10:00:00Z');

    const applied = await svc.applySubscriptionEvent('txn-1', { status: 'expired' }, { eventUid: 'u1', eventAt: at });

    expect(applied).toBe(true);
    expect(saved).toHaveLength(1);
    expect(row.status).toBe('expired');
    expect(row.lastEventUid).toBe('u1');
    expect(row.lastEventAt).toEqual(at);
  });

  it('THE BUG: a stale EXPIRED does not revoke a subscriber who has since renewed', async () => {
    // renewal landed at 10:00 and set the term active
    const row = make({ status: 'active', lastEventUid: 'renew', lastEventAt: new Date('2026-08-01T10:00:00Z') });
    const { svc, saved } = harness(row);

    // Apple retries the EXPIRED it issued at 09:00, after the renewal
    const applied = await svc.applySubscriptionEvent(
      'txn-1',
      { status: 'expired' },
      { eventUid: 'expire', eventAt: new Date('2026-08-01T09:00:00Z') },
    );

    expect(applied).toBe(false);
    expect(row.status).toBe('active'); // still paying, still has access
    expect(saved).toHaveLength(0); // and no write at all
  });

  it('an exact redelivery of an applied event is not applied twice', async () => {
    const row = make({ lastEventUid: 'u1', lastEventAt: new Date('2026-08-01T10:00:00Z') });
    const { svc, saved } = harness(row);

    const applied = await svc.applySubscriptionEvent(
      'txn-1',
      { status: 'revoked' },
      { eventUid: 'u1', eventAt: new Date('2026-08-01T10:00:00Z') },
    );

    // false is what stops the caller recording the same cancellation again
    expect(applied).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('a NEWER event still applies over an older one', async () => {
    const row = make({ status: 'expired', lastEventUid: 'old', lastEventAt: new Date('2026-08-01T09:00:00Z') });
    const { svc } = harness(row);

    const applied = await svc.applySubscriptionEvent(
      'txn-1',
      { status: 'active' },
      { eventUid: 'new', eventAt: new Date('2026-08-01T10:00:00Z') },
    );

    expect(applied).toBe(true);
    expect(row.status).toBe('active');
  });

  it('an equal timestamp is allowed through', async () => {
    // two genuine events can share a second; dropping the second would lose a real
    // state change, and the uid check already covers an actual redelivery.
    const at = new Date('2026-08-01T10:00:00Z');
    const row = make({ lastEventUid: 'first', lastEventAt: at });
    const { svc } = harness(row);

    expect(await svc.applySubscriptionEvent('txn-1', { status: 'revoked' }, { eventUid: 'second', eventAt: at })).toBe(
      true,
    );
    expect(row.status).toBe('revoked');
  });

  it('a first-ever event on an unstamped row applies', async () => {
    // existing rows predate the columns; they must not be treated as stale forever.
    const row = make({ lastEventAt: null, lastEventUid: null });
    const { svc } = harness(row);

    const applied = await svc.applySubscriptionEvent(
      'txn-1',
      { status: 'expired' },
      { eventUid: 'u1', eventAt: new Date('2020-01-01T00:00:00Z') },
    );
    expect(applied).toBe(true);
  });

  it('still works with no meta at all (client-driven validate path)', async () => {
    const row = make();
    const { svc } = harness(row);
    expect(await svc.applySubscriptionEvent('txn-1', { status: 'expired' })).toBe(true);
    expect(row.status).toBe('expired');
  });

  it('an unknown transaction ref is not applied', async () => {
    const { svc } = harness(null);
    expect(await svc.applySubscriptionEvent('nope', { status: 'expired' }, { eventUid: 'u1' })).toBe(false);
  });

  it('an empty ref is rejected before touching the database', async () => {
    const { svc, repo } = harness(make());
    expect(await svc.applySubscriptionEvent('', { status: 'expired' })).toBe(false);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('a stamp-only event (Play CANCELED) records the event without changing status', async () => {
    // auto-renew off: the term stays active until it lapses, but the event must be
    // stamped so its redelivery is recognised instead of counted as a second cancel.
    const row = make({ status: 'active' });
    const { svc } = harness(row);

    expect(await svc.applySubscriptionEvent('txn-1', {}, { eventUid: 'cancel-1', eventAt: new Date() })).toBe(true);
    expect(row.status).toBe('active');
    expect(row.lastEventUid).toBe('cancel-1');

    // the redelivery is now recognised
    expect(await svc.applySubscriptionEvent('txn-1', {}, { eventUid: 'cancel-1', eventAt: new Date() })).toBe(false);
  });
});
