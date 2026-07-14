import { UnauthorizedException } from '@nestjs/common';

// Mock config so we control the premium-SKU allowlist per test without a real env.
jest.mock('../config', () => ({
  config: { premiumProductIds: [] as string[], apple: {}, google: {} },
  devFallback: false,
  integrations: { appleIap: false, googleIap: false },
  isProd: true,
}));

import { config } from '../config';
import { ReceiptValidationService } from './receipt-validation.service';

// The money path has no automated coverage; these lock the anti-fraud guards that
// decide whether a verified transaction actually grants premium.
describe('ReceiptValidationService - money-path guards', () => {
  const svc = new ReceiptValidationService();
  // planFor + assertPremiumSku are private; exercise them directly (they ARE the guard).
  const planFor = (id?: string): string => (svc as unknown as { planFor(id?: string): string }).planFor(id);
  const assertSku = (sku?: string): void =>
    (svc as unknown as { assertPremiumSku(sku?: string): void }).assertPremiumSku(sku);

  afterEach(() => {
    (config as { premiumProductIds: string[] }).premiumProductIds = [];
  });

  describe('planFor', () => {
    it('maps annual/yearly product ids to the annual plan', () => {
      expect(planFor('calmcarry.premium.annual')).toBe('annual');
      expect(planFor('com.glow.premium.yearly')).toBe('annual');
    });
    it('defaults to monthly (including a missing id)', () => {
      expect(planFor('calmcarry.premium.monthly')).toBe('monthly');
      expect(planFor(undefined)).toBe('monthly');
    });
  });

  describe('assertPremiumSku (SKU allowlist)', () => {
    it('skips the check when no allowlist is configured (dev)', () => {
      (config as { premiumProductIds: string[] }).premiumProductIds = [];
      expect(() => assertSku(undefined)).not.toThrow();
      expect(() => assertSku('literally.anything')).not.toThrow();
    });

    it('accepts a SKU that is on the allowlist', () => {
      (config as { premiumProductIds: string[] }).premiumProductIds = [
        'calmcarry.premium.monthly',
        'calmcarry.premium.annual',
      ];
      expect(() => assertSku('calmcarry.premium.annual')).not.toThrow();
    });

    it('rejects a SKU that is NOT on the allowlist', () => {
      (config as { premiumProductIds: string[] }).premiumProductIds = ['calmcarry.premium.monthly'];
      expect(() => assertSku('some.other.consumable')).toThrow(UnauthorizedException);
    });

    it('rejects a MISSING SKU when an allowlist exists (the money-path hole guard)', () => {
      (config as { premiumProductIds: string[] }).premiumProductIds = ['calmcarry.premium.monthly'];
      expect(() => assertSku(undefined)).toThrow(UnauthorizedException);
    });
  });
});
