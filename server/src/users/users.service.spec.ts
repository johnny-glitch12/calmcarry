import { Entitlement } from '../entities';
import { UsersService } from './users.service';

// Pure-logic unit test of the premium gate (the expiry-aware check that the whole
// paywall relies on - including the fix where an "active" but expired calm_plan
// must NOT unlock content). No DB/DI needed: isPremiumEntitlement is pure.
const make = (over: Partial<Entitlement>): Entitlement =>
  ({
    id: 'e1',
    ownerId: 'o1',
    owner: undefined as never,
    tier: 'free',
    sourceOrderId: null,
    status: 'active',
    source: null,
    plan: null,
    productId: null,
    transactionRef: null,
    expiresAt: null,
    grantedAt: new Date(),
    ...over,
  }) as Entitlement;

describe('UsersService.isPremiumEntitlement', () => {
  const svc = new UsersService(null as never, null as never, null as never, null as never);

  it('free tier is not premium', () => {
    expect(svc.isPremiumEntitlement(make({ tier: 'free' }))).toBe(false);
  });

  it('active calm_plan with no expiry is premium', () => {
    expect(svc.isPremiumEntitlement(make({ tier: 'calm_plan' }))).toBe(true);
  });

  it('active calm_plan expiring in the future is premium', () => {
    expect(svc.isPremiumEntitlement(make({ tier: 'calm_plan', expiresAt: new Date(Date.now() + 86_400_000) }))).toBe(true);
  });

  it('an EXPIRED calm_plan is NOT premium (security regression guard)', () => {
    expect(svc.isPremiumEntitlement(make({ tier: 'calm_plan', expiresAt: new Date('2020-01-01') }))).toBe(false);
  });

  it('a revoked calm_plan is not premium', () => {
    expect(svc.isPremiumEntitlement(make({ tier: 'calm_plan', status: 'revoked' }))).toBe(false);
  });

  it('null / no entitlement is not premium', () => {
    expect(svc.isPremiumEntitlement(null)).toBe(false);
    expect(svc.isPremiumEntitlement(undefined)).toBe(false);
  });
});
