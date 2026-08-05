import { Entitlement } from '../entities';
import { UsersService } from './users.service';

/**
 * A caregiver's OWN subscription must stay visible to them.
 *
 * getEffectiveEntitlement resolved to the household primary and read only that
 * account's rows. Someone who subscribed and later joined a household stopped being
 * able to see the subscription they were still paying Apple for - and if the
 * household's plan lapsed they lost access while their card kept being charged.
 */
const ent = (over: Partial<Entitlement>): Entitlement =>
  ({
    id: 'e',
    ownerId: 'x',
    owner: undefined as never,
    tier: 'calm_plan',
    sourceOrderId: null,
    status: 'active',
    source: 'apple',
    plan: 'monthly',
    productId: null,
    transactionRef: null,
    expiresAt: null,
    lastEventAt: null,
    lastEventUid: null,
    grantedAt: new Date(),
    ...over,
  }) as Entitlement;

/** Repo double that honours the `where: [{ownerId}, ...]` OR-array the service sends. */
function harness(rows: Entitlement[], householdOf: Record<string, string> = {}) {
  const repo = {
    find: jest.fn(async ({ where }: { where: { ownerId: string }[] | { ownerId: string } }) => {
      const clauses = Array.isArray(where) ? where : [where];
      const ids = new Set(clauses.map((c) => c.ownerId));
      return rows.filter((r) => ids.has(r.ownerId));
    }),
  };
  const household = {
    resolveOwnerId: jest.fn(async (id: string) => householdOf[id] ?? id),
  };
  const svc = new UsersService(null as never, repo as never, null as never, household as never);
  return { svc, repo, household };
}

describe('getEffectiveEntitlement across a household', () => {
  it('a primary reads their own entitlement', async () => {
    // POSITIVE CONTROL
    const { svc } = harness([ent({ ownerId: 'primary', id: 'p1' })]);
    expect((await svc.getEffectiveEntitlement('primary'))?.id).toBe('p1');
  });

  it('a caregiver inherits the household subscription', async () => {
    const { svc } = harness([ent({ ownerId: 'primary', id: 'p1' })], { caregiver: 'primary' });
    expect((await svc.getEffectiveEntitlement('caregiver'))?.id).toBe('p1');
  });

  it('THE BUG: a caregiver keeps the subscription they are personally paying for', async () => {
    // household plan has lapsed; the caregiver's own plan is live and being billed
    const rows = [
      ent({ ownerId: 'primary', id: 'p1', status: 'expired' }),
      ent({ ownerId: 'caregiver', id: 'c1', status: 'active' }),
    ];
    const { svc } = harness(rows, { caregiver: 'primary' });

    const eff = await svc.getEffectiveEntitlement('caregiver');
    expect(eff?.id).toBe('c1');
    expect(svc.isPremiumEntitlement(eff)).toBe(true); // still has what they pay for
  });

  it('an expired own-plan does not stop them inheriting a live household plan', async () => {
    const rows = [
      ent({ ownerId: 'primary', id: 'p1', status: 'active' }),
      ent({ ownerId: 'caregiver', id: 'c1', status: 'expired' }),
    ];
    const { svc } = harness(rows, { caregiver: 'primary' });
    expect(svc.isPremiumEntitlement(await svc.getEffectiveEntitlement('caregiver'))).toBe(true);
  });

  it('two dead plans stay dead - this never invents premium', async () => {
    const rows = [
      ent({ ownerId: 'primary', id: 'p1', status: 'expired' }),
      ent({ ownerId: 'caregiver', id: 'c1', expiresAt: new Date('2020-01-01') }),
    ];
    const { svc } = harness(rows, { caregiver: 'primary' });
    expect(svc.isPremiumEntitlement(await svc.getEffectiveEntitlement('caregiver'))).toBe(false);
  });

  it('a caregiver with no plan anywhere gets null', async () => {
    const { svc } = harness([], { caregiver: 'primary' });
    expect(await svc.getEffectiveEntitlement('caregiver')).toBeNull();
  });

  it('a primary is queried for one id only, not duplicated', async () => {
    const { svc, repo } = harness([ent({ ownerId: 'primary' })]);
    await svc.getEffectiveEntitlement('primary');
    const where = repo.find.mock.calls[0][0].where as { ownerId: string }[];
    expect(where).toHaveLength(1);
  });

  it('does not leak another household member into the query', async () => {
    // reading both ids must mean SELF + household, never an unrelated account
    const { svc, repo } = harness([], { caregiver: 'primary' });
    await svc.getEffectiveEntitlement('caregiver');
    const where = repo.find.mock.calls[0][0].where as { ownerId: string }[];
    expect(new Set(where.map((w) => w.ownerId))).toEqual(new Set(['primary', 'caregiver']));
  });
});
