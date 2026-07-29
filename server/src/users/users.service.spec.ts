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

/**
 * Email identity must be case-insensitive. It used to be a case-SENSITIVE unique
 * column with only the social path lowercasing, so "Mason@Glowco.com" and
 * "mason@glowco.com" were different accounts: a correct password was rejected and
 * password reset silently did nothing.
 */
describe('UsersService.normalizeEmail', () => {
  it('lowercases and trims so one address is one identity', () => {
    expect(UsersService.normalizeEmail('Mason@Glowco.com')).toBe('mason@glowco.com');
    expect(UsersService.normalizeEmail('  MASON@GLOWCO.COM  ')).toBe('mason@glowco.com');
  });

  it('maps every casing of the same address to one key', () => {
    const forms = ['mason@glowco.com', 'Mason@Glowco.com', 'MASON@GLOWCO.COM', ' mason@Glowco.com '];
    expect(new Set(forms.map((f) => UsersService.normalizeEmail(f))).size).toBe(1);
  });

  it('is safe on empty/absent input', () => {
    expect(UsersService.normalizeEmail('')).toBe('');
    expect(UsersService.normalizeEmail(undefined as unknown as string)).toBe('');
  });
});
