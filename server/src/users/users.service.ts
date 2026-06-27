import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { HouseholdService } from '../household/household.service';
import {
  CaregiverInvite,
  CaregiverLink,
  CommunityPost,
  Device,
  Entitlement,
  Owner,
  Profile,
  PushToken,
  SavedMix,
  SessionLog,
  WarrantyClaim,
} from '../entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    @InjectRepository(Entitlement)
    private readonly entitlementRepo: Repository<Entitlement>,
    private readonly dataSource: DataSource,
    private readonly household: HouseholdService,
  ) {}

  /**
   * Permanently delete an account and ALL its data (Apple 5.1.1(v) in-app account
   * deletion + COPPA/GDPR data rights — build plan §13 data minimization). Runs in
   * a transaction, children first, so nothing is orphaned.
   */
  async deleteAccount(ownerId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const deviceIds = (await m.find(Device, { where: { ownerId }, select: { id: true } })).map((d) => d.id);
      const profileIds = (await m.find(Profile, { where: { ownerId }, select: { id: true } })).map((p) => p.id);
      if (deviceIds.length) await m.delete(WarrantyClaim, { deviceId: In(deviceIds) });
      if (profileIds.length) await m.delete(SavedMix, { profileId: In(profileIds) });
      await m.delete(CommunityPost, { ownerId });
      await m.delete(SessionLog, { ownerId });
      await m.delete(PushToken, { ownerId });
      // Household links: clear both directions so no caregiver is left inheriting a
      // deleted owner's entitlement, and no dangling link points at a gone account.
      // If this owner was a household primary, its caregivers fall back to their own
      // (free) entitlement; if it was a caregiver, its link is simply removed.
      await m.delete(CaregiverLink, [{ householdOwnerId: ownerId }, { caregiverOwnerId: ownerId }]);
      await m.delete(CaregiverInvite, [{ householdOwnerId: ownerId }, { redeemedByOwnerId: ownerId }]);
      await m.delete(Device, { ownerId });
      await m.delete(Profile, { ownerId });
      await m.delete(Entitlement, { ownerId });
      await m.delete(Owner, { id: ownerId });
    });
  }

  /** Store/clear the Apple refresh token used to revoke the user's tokens on deletion. */
  async setAppleRefreshToken(ownerId: string, token: string | null): Promise<void> {
    await this.ownerRepo.update({ id: ownerId }, { appleRefreshToken: token });
  }

  /** GDPR/UK-GDPR/AU-APP12 data-access export — the account's own data as JSON
   *  (build plan §13). NEVER includes the password hash or the Apple refresh token. */
  async exportAccount(ownerId: string): Promise<Record<string, unknown>> {
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    if (!owner) return {};
    const profileRepo = this.dataSource.getRepository(Profile);
    const profiles = await profileRepo.find({ where: { ownerId } });
    const profileIds = profiles.map((p) => p.id);
    const [devices, entitlements, savedMixes, sessionLogs] = await Promise.all([
      this.dataSource.getRepository(Device).find({ where: { ownerId } }),
      this.entitlementRepo.find({ where: { ownerId } }),
      profileIds.length
        ? this.dataSource.getRepository(SavedMix).find({ where: { profileId: In(profileIds) } })
        : Promise.resolve([]),
      this.dataSource.getRepository(SessionLog).find({ where: { ownerId } }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: { id: owner.id, email: owner.email, name: owner.name, createdAt: owner.createdAt },
      profiles,
      devices,
      entitlements,
      savedMixes,
      sessionLogs,
    };
  }

  findByEmail(email: string): Promise<Owner | null> {
    return this.ownerRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<Owner | null> {
    return this.ownerRepo.findOne({ where: { id } });
  }

  async createOwner(
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<Owner> {
    const owner = this.ownerRepo.create({ email, passwordHash, name });
    return this.ownerRepo.save(owner);
  }

  async grantEntitlement(
    ownerId: string,
    tier: Entitlement['tier'],
    sourceOrderId: string | null = null,
  ): Promise<Entitlement> {
    const entitlement = this.entitlementRepo.create({
      ownerId,
      tier,
      sourceOrderId,
      status: 'active',
    });
    return this.entitlementRepo.save(entitlement);
  }

  /** Grant/refresh a premium subscription from a validated IAP receipt or Shopify order. */
  async grantSubscription(
    ownerId: string,
    sub: {
      source: Entitlement['source'];
      plan?: Entitlement['plan'];
      productId?: string | null;
      transactionRef?: string | null;
      expiresAt?: Date | null;
      sourceOrderId?: string | null;
    },
  ): Promise<Entitlement> {
    // A subscription covers the whole HOUSEHOLD, and reads resolve to the household
    // owner — so the grant must too. A caregiver's purchase therefore upgrades the
    // primary's account (where every member, including the caregiver, reads it).
    const householdId = await this.household.resolveOwnerId(ownerId);
    // A purchase/transaction belongs to exactly ONE account. Look it up GLOBALLY
    // (not scoped to this owner): if the same receipt/transactionRef is already
    // bound to a DIFFERENT account, reject — otherwise one paid receipt could be
    // replayed to upgrade unlimited accounts. Same owner = a renewal → update the
    // one row so a later expired/revoked status actually downgrades them.
    const existing = sub.transactionRef
      ? await this.entitlementRepo.findOne({ where: { transactionRef: sub.transactionRef } })
      : null;
    if (existing && existing.ownerId !== householdId) {
      throw new ConflictException('This purchase is already linked to another account.');
    }
    const entitlement = existing ?? this.entitlementRepo.create({ ownerId: householdId });
    entitlement.tier = 'calm_plan';
    entitlement.status = 'active';
    entitlement.source = sub.source ?? null;
    entitlement.plan = sub.plan ?? null;
    entitlement.productId = sub.productId ?? null;
    entitlement.transactionRef = sub.transactionRef ?? null;
    entitlement.expiresAt = sub.expiresAt ?? null;
    entitlement.sourceOrderId = sub.sourceOrderId ?? null;
    return this.entitlementRepo.save(entitlement);
  }

  /**
   * Returns the owner's effective entitlement. An active calm_plan whose
   * expiresAt has passed no longer counts as premium.
   */
  async getEffectiveEntitlement(ownerId: string): Promise<Entitlement | null> {
    // a caregiver inherits the household's entitlement (one subscription, whole family)
    const householdId = await this.household.resolveOwnerId(ownerId);
    const entitlements = await this.entitlementRepo.find({
      where: { ownerId: householdId },
      order: { grantedAt: 'DESC' },
    });
    if (entitlements.length === 0) return null;

    const now = Date.now();
    const premium = entitlements.find(
      (e) =>
        e.status === 'active' &&
        e.tier === 'calm_plan' &&
        (!e.expiresAt || new Date(e.expiresAt).getTime() > now),
    );
    if (premium) return premium;

    const anyActive = entitlements.find((e) => e.status === 'active');
    return anyActive ?? entitlements[0];
  }

  /** Single source of truth for "is this entitlement premium RIGHT NOW" — active,
   *  calm_plan, and not past its expiry. Used by every paywall gate. */
  isPremiumEntitlement(e: Entitlement | null | undefined): boolean {
    return (
      !!e &&
      e.tier === 'calm_plan' &&
      e.status === 'active' &&
      (!e.expiresAt || new Date(e.expiresAt).getTime() > Date.now())
    );
  }

  async isPremium(ownerId: string): Promise<boolean> {
    return this.isPremiumEntitlement(await this.getEffectiveEntitlement(ownerId));
  }

  /**
   * Apply a store lifecycle event (App Store Server Notification / Play RTDN) to the
   * subscription keyed by its renewal ref (Apple originalTransactionId / Google
   * purchaseToken). This is how renewals, cancellations, expiries and refunds reach
   * us WITHOUT a client call — without it, a cancelled/refunded sub stays "premium"
   * until the client happens to re-validate. Returns false if we don't know the ref.
   */
  async applySubscriptionEvent(
    transactionRef: string,
    patch: { status?: Entitlement['status']; expiresAt?: Date | null },
  ): Promise<boolean> {
    if (!transactionRef) return false;
    const e = await this.entitlementRepo.findOne({ where: { transactionRef } });
    if (!e) return false;
    if (patch.status) e.status = patch.status;
    if (patch.expiresAt !== undefined) {
      // Clamp a store-supplied expiry to a sane ceiling (longest plan + grace) so a
      // forged/over-long "expires" can never grant years of free premium.
      const MAX_AHEAD_MS = 400 * 86_400_000; // ~13 months
      e.expiresAt =
        patch.expiresAt && patch.expiresAt.getTime() > Date.now() + MAX_AHEAD_MS
          ? new Date(Date.now() + MAX_AHEAD_MS)
          : patch.expiresAt;
    }
    await this.entitlementRepo.save(e);
    return true;
  }
}
