import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { HouseholdService } from '../household/household.service';
import {
  AuthCode,
  CaregiverInvite,
  CaregiverLink,
  CommunityPost,
  CommunityReport,
  Device,
  Entitlement,
  Owner,
  Profile,
  PushToken,
  RefreshToken,
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
   * deletion + COPPA/GDPR data rights - build plan §13 data minimization). Runs in
   * a transaction, children first, so nothing is orphaned.
   */
  async deleteAccount(ownerId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const deviceIds = (await m.find(Device, { where: { ownerId }, select: { id: true } })).map((d) => d.id);
      const profileIds = (await m.find(Profile, { where: { ownerId }, select: { id: true } })).map((p) => p.id);
      if (deviceIds.length) await m.delete(WarrantyClaim, { deviceId: In(deviceIds) });
      if (profileIds.length) await m.delete(SavedMix, { profileId: In(profileIds) });
      await m.delete(CommunityPost, { ownerId });
      // Reports carry the REPORTER's account id. Without this they outlived the
      // account that made them - a permanent record of one person's moderation
      // activity, after they asked to be erased - which makes the app's own
      // "your data is erased" promise false. (Added with the reports table itself;
      // the table was new, this deletion was not written at the same time.)
      await m.delete(CommunityReport, { ownerId });
      await m.delete(SessionLog, { ownerId });
      await m.delete(PushToken, { ownerId });
      await m.delete(AuthCode, { ownerId });
      await m.delete(RefreshToken, { ownerId });
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

  /** Replace the password hash (password reset). */
  async setPassword(ownerId: string, passwordHash: string): Promise<void> {
    await this.ownerRepo.update({ id: ownerId }, { passwordHash });
  }

  /**
   * End every existing session for this account by advancing its token generation.
   * JwtAuthGuard rejects any access token whose `tv` no longer matches, so this
   * invalidates tokens that are already in circulation - deleting refresh tokens
   * alone left a stolen access token working for the rest of its 7-day life.
   * Returns the new value so the caller can mint a replacement pair that survives.
   */
  async bumpTokenVersion(ownerId: string): Promise<number> {
    await this.ownerRepo.increment({ id: ownerId }, 'tokenVersion', 1);
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    return owner?.tokenVersion ?? 0;
  }

  /** Mark the account's email as verified (soft gate). */
  async setEmailVerified(ownerId: string): Promise<void> {
    await this.ownerRepo.update({ id: ownerId }, { emailVerified: true });
  }

  /** Store/clear the Apple refresh token used to revoke the user's tokens on deletion. */
  async setAppleRefreshToken(ownerId: string, token: string | null): Promise<void> {
    await this.ownerRepo.update({ id: ownerId }, { appleRefreshToken: token });
  }

  // Cross-device preference sync. STRICT allow-list - anything not listed here is
  // silently dropped, so the client can never turn this into a general data store.
  // Deliberately absent: mood/feeling (build plan §3/§14 - never a stored mood log).
  // `favoritesUpdatedAt` is a client clock (ms epoch) and is stored verbatim, never
  // trusted for anything but comparing two copies of one account's own favourites.
  // It decides which device's list wins a reconcile; a wrong value costs that user
  // their own save order and nothing else, so it needs no server-side authority.
  private static readonly PREF_KEYS = [
    'goals',
    'moments',
    'favorites',
    'favoritesUpdatedAt',
    'sleepGoalHours',
    'voice',
  ] as const;

  async getPrefs(ownerId: string): Promise<Record<string, unknown>> {
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    return owner?.prefs ?? {};
  }

  /** Merge allow-listed prefs (last write wins per key). Returns the stored set. */
  async setPrefs(ownerId: string, raw: Record<string, unknown>): Promise<Record<string, unknown>> {
    const clean: Record<string, unknown> = {};
    for (const k of UsersService.PREF_KEYS) {
      const v = raw[k];
      if (v === undefined) continue;
      // keep values small + JSON-simple: arrays of short strings, or primitives
      if (Array.isArray(v)) clean[k] = v.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, 100);
      else if (typeof v === 'string' && v.length <= 64) clean[k] = v;
      else if (typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
    }
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    if (!owner) return {};
    owner.prefs = { ...(owner.prefs ?? {}), ...clean };
    await this.ownerRepo.save(owner);
    return owner.prefs;
  }

  /** GDPR/UK-GDPR/AU-APP12 data-access export - the account's own data as JSON
   *  (build plan §13). NEVER includes the password hash or the Apple refresh token. */
  async exportAccount(ownerId: string): Promise<Record<string, unknown>> {
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    if (!owner) return {};
    const profileRepo = this.dataSource.getRepository(Profile);
    const profiles = await profileRepo.find({ where: { ownerId } });
    const profileIds = profiles.map((p) => p.id);
    const [devices, entitlements, savedMixes, sessionLogs, communityPosts, pushTokens] = await Promise.all([
      this.dataSource.getRepository(Device).find({ where: { ownerId } }),
      this.entitlementRepo.find({ where: { ownerId } }),
      profileIds.length
        ? this.dataSource.getRepository(SavedMix).find({ where: { profileId: In(profileIds) } })
        : Promise.resolve([]),
      this.dataSource.getRepository(SessionLog).find({ where: { ownerId } }),
      this.dataSource.getRepository(CommunityPost).find({ where: { ownerId } }),
      this.dataSource.getRepository(PushToken).find({ where: { ownerId } }),
    ]);
    // Warranty claims hang off the DEVICE, not the owner, so they need the device ids.
    const deviceIds = devices.map((d) => d.id);
    const warrantyClaims = deviceIds.length
      ? await this.dataSource.getRepository(WarrantyClaim).find({ where: { deviceId: In(deviceIds) } })
      : [];
    return {
      exportedAt: new Date().toISOString(),
      account: { id: owner.id, email: owner.email, name: owner.name, createdAt: owner.createdAt },
      prefs: owner.prefs ?? {},
      profiles,
      devices,
      entitlements,
      savedMixes,
      sessionLogs,
      // These three are account-linked and were MISSING, while the in-app screen
      // promises "export everything tied to your account" - an incomplete access
      // response and an inaccurate published claim at the same time. Community posts
      // in particular carry ownerId, so they are the user's data even though they
      // appear publicly under a generic handle.
      communityPosts,
      pushTokens,
      warrantyClaims,
    };
  }

  /**
   * Email is stored and looked up CASE-INSENSITIVELY (normalized to lowercase here,
   * at the single choke point every caller passes through, rather than in each DTO).
   *
   * Without this, `email` was a case-SENSITIVE unique varchar: someone who signed up
   * as "Mason@Glowco.com" and later typed the lowercase form got "Invalid
   * credentials" with the correct password, "Forgot password" silently sent nothing
   * (anti-enumeration hides the miss), and a second account could be created on the
   * same address in different case. Only the social-login path lowercased, so the
   * two routes disagreed about who you were.
   */
  static normalizeEmail(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  findByEmail(email: string): Promise<Owner | null> {
    return this.ownerRepo.findOne({ where: { email: UsersService.normalizeEmail(email) } });
  }

  findById(id: string): Promise<Owner | null> {
    return this.ownerRepo.findOne({ where: { id } });
  }

  async createOwner(
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<Owner> {
    // Normalized on write too, so the unique index and every later lookup agree.
    const owner = this.ownerRepo.create({ email: UsersService.normalizeEmail(email), passwordHash, name });
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
    // owner - so the grant must too. A caregiver's purchase therefore upgrades the
    // primary's account (where every member, including the caregiver, reads it).
    const householdId = await this.household.resolveOwnerId(ownerId);
    // A purchase/transaction belongs to exactly ONE account. Look it up GLOBALLY
    // (not scoped to this owner): if the same receipt/transactionRef is already
    // bound to a DIFFERENT account, reject - otherwise one paid receipt could be
    // replayed to upgrade unlimited accounts. Same owner = a renewal → update the
    // one row so a later expired/revoked status actually downgrades them.
    const existing = sub.transactionRef
      ? await this.entitlementRepo.findOne({ where: { transactionRef: sub.transactionRef } })
      : null;
    if (existing && existing.ownerId !== householdId) {
      throw new ConflictException('This purchase is already linked to another account.');
    }
    // A REVOKED/REFUNDED entitlement must never be resurrected by re-validating the
    // same receipt. A signed JWS transaction stays cryptographically valid forever,
    // and the client can re-POST the exact body it already sent, so without this a
    // user could refund via Apple and then restore premium at will (and repeat).
    // Only the store (webhook) may lift a revocation.
    if (existing && existing.status === 'revoked') {
      throw new ConflictException('This purchase was refunded or revoked and cannot be restored.');
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
    // A caregiver inherits the household's entitlement (one subscription, whole
    // family) - but their OWN entitlement still counts.
    //
    // This used to read the household's rows only. Someone who subscribed and later
    // joined a household stopped being able to see the subscription they were still
    // paying Apple for: their row sat on their own id, the lookup resolved to the
    // primary, and if the household's plan lapsed they lost access while their card
    // kept getting charged. Reading both and taking the best means joining a
    // household can never leave anyone worse off than before they joined.
    const householdId = await this.household.resolveOwnerId(ownerId);
    const ids = householdId === ownerId ? [householdId] : [householdId, ownerId];
    const entitlements = await this.entitlementRepo.find({
      where: ids.map((id) => ({ ownerId: id })),
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

  /** Single source of truth for "is this entitlement premium RIGHT NOW" - active,
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
   * us WITHOUT a client call - without it, a cancelled/refunded sub stays "premium"
   * until the client happens to re-validate. Returns false if we don't know the ref.
   */
  /**
   * Apply a store lifecycle event (webhook) to the entitlement it names.
   *
   * Returns false when nothing was applied - unknown ref, an exact redelivery, or an
   * event older than one already applied. Callers must treat false as "do not record
   * churn", or a single retried cancellation is counted every time Apple resends it.
   *
   * `meta` carries the store's own identity and timestamp for the event. Both stores
   * deliver at-least-once and out of order, so without them a retried EXPIRED that
   * lost a race with a later DID_RENEW silently revokes a paying subscriber.
   */
  async applySubscriptionEvent(
    transactionRef: string,
    patch: { status?: Entitlement['status']; expiresAt?: Date | null },
    meta?: { eventUid?: string; eventAt?: Date },
  ): Promise<boolean> {
    if (!transactionRef) return false;
    const e = await this.entitlementRepo.findOne({ where: { transactionRef } });
    if (!e) return false;

    // Exact redelivery of an event we already applied: the state is already correct,
    // and re-applying would double-count the churn the caller records on success.
    if (meta?.eventUid && e.lastEventUid && e.lastEventUid === meta.eventUid) return false;

    // Out-of-order delivery. Strictly older loses; equal timestamps are allowed
    // through because two genuine events can share a second and dropping the second
    // would lose a real state change.
    if (meta?.eventAt && e.lastEventAt && meta.eventAt.getTime() < e.lastEventAt.getTime()) {
      return false;
    }

    if (meta?.eventUid) e.lastEventUid = meta.eventUid;
    if (meta?.eventAt) e.lastEventAt = meta.eventAt;
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
