import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { CaregiverInvite, CaregiverLink, Owner } from '../entities';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// One paid subscription unlocks a HOUSEHOLD, not the world. Cap members so a single
// sub can't be resold/shared with unlimited accounts (each caregiver inherits premium).
const MAX_CAREGIVERS = 5;

@Injectable()
export class CaregiversService {
  constructor(
    @InjectRepository(CaregiverInvite) private readonly invites: Repository<CaregiverInvite>,
    @InjectRepository(CaregiverLink) private readonly links: Repository<CaregiverLink>,
    @InjectRepository(Owner) private readonly owners: Repository<Owner>,
    private readonly dataSource: DataSource,
  ) {}

  /** Primary creates a one-time, expiring code to share out-of-band. */
  async createInvite(householdOwnerId: string): Promise<{ code: string; expiresAt: Date }> {
    // a caregiver can't invite (only the household primary)
    const isCaregiver = await this.links.findOne({ where: { caregiverOwnerId: householdOwnerId } });
    if (isCaregiver) throw new ForbiddenException('Only the household owner can invite caregivers.');

    // Bound outstanding capacity (existing members + codes that could still be
    // redeemed) to the cap, so a subscriber can't mint an unlimited pile of
    // redeemable invites.
    //
    // "Could still be redeemed" is the important part. This used to count every
    // unredeemed invite regardless of age, so a household that sent five codes nobody
    // used was locked out of inviting FOREVER: the codes expired after 7 days, became
    // permanently unredeemable, and still filled all five slots. The household had no
    // caregivers, no usable codes, and no way to make one. An expired invite grants
    // nothing, so it must not reserve capacity.
    const [linkCount, outstanding] = await Promise.all([
      this.links.count({ where: { householdOwnerId } }),
      this.invites.count({
        where: { householdOwnerId, redeemedByOwnerId: IsNull(), expiresAt: MoreThan(new Date()) },
      }),
    ]);
    // Reuse the household's newest still-valid code instead of minting a fresh one on
    // every tap. The app only holds the code in screen state, so a user who dismisses
    // the screen loses it - and each tap used to consume another capacity slot, so a
    // few taps could fill the cap with codes nobody has and lock out inviting with
    // zero caregivers. Handing back the existing code makes the button idempotent and
    // lets a user re-open the screen to see the code they already generated.
    if (outstanding > 0) {
      const active = await this.invites.findOne({
        where: { householdOwnerId, redeemedByOwnerId: IsNull(), expiresAt: MoreThan(new Date()) },
        order: { expiresAt: 'DESC' },
      });
      if (active?.expiresAt) return { code: active.code, expiresAt: active.expiresAt };
    }

    if (linkCount + outstanding >= MAX_CAREGIVERS) {
      throw new BadRequestException('This household has reached its caregiver limit.');
    }

    // ~48 bits of entropy (3 groups), single-use + 7-day expiry, and /redeem is
    // rate-limited - so an invite code can't be feasibly brute-forced.
    const grp = () => crypto.randomBytes(2).toString('hex');
    const code = `${grp()}-${grp()}-${grp()}`.toUpperCase();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.invites.save(this.invites.create({ code, householdOwnerId, expiresAt }));
    return { code, expiresAt };
  }

  /** Caregiver redeems a code → joins the household (inherits its premium + data).
   *  Atomic: the invite is consumed with a conditional update (code AND not-yet-redeemed),
   *  so two concurrent redeems of the same code can't both create a link. */
  async redeem(caregiverOwnerId: string, rawCode: string): Promise<{ ok: true }> {
    const code = (rawCode ?? '').trim().toUpperCase();
    return this.dataSource.transaction(async (m) => {
      const invite = await m.findOne(CaregiverInvite, { where: { code } });
      if (!invite || invite.redeemedByOwnerId) throw new NotFoundException('Invalid or used invite code.');
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        throw new BadRequestException('This invite has expired.');
      }
      if (invite.householdOwnerId === caregiverOwnerId) {
        throw new BadRequestException('You can’t join your own household.');
      }
      const existing = await m.findOne(CaregiverLink, { where: { caregiverOwnerId } });
      if (existing) throw new BadRequestException('You already belong to a household.');
      // A household HOST (someone who has invited caregivers) must not also become a
      // caregiver of another household - that would re-point their resolveOwnerId away
      // from their own household and strand the caregivers who depend on them.
      const isHost = await m.findOne(CaregiverLink, { where: { householdOwnerId: caregiverOwnerId } });
      if (isHost) throw new BadRequestException('You already host a household and can’t also join another.');

      // Enforce the household cap at redeem time - this is the gate that actually
      // grants the inherited premium, so the ceiling must hold here. (SQLite serializes
      // write txns and the invite-consume below is atomic; a rare Postgres concurrent
      // race could overshoot by one, bounded and non-material for a human-scale action.)
      const memberCount = await m.count(CaregiverLink, { where: { householdOwnerId: invite.householdOwnerId } });
      if (memberCount >= MAX_CAREGIVERS) throw new BadRequestException('This household is already full.');

      // consume the invite atomically - only succeeds if it's still unredeemed
      const consumed = await m.update(
        CaregiverInvite,
        { code, redeemedByOwnerId: IsNull() },
        { redeemedByOwnerId: caregiverOwnerId },
      );
      if (!consumed.affected) throw new NotFoundException('Invalid or used invite code.');

      await m.save(m.create(CaregiverLink, { householdOwnerId: invite.householdOwnerId, caregiverOwnerId }));
      return { ok: true };
    });
  }

  /** Who's in my household (people I've added) + the household I belong to, if any. */
  async list(ownerId: string): Promise<{
    caregivers: { id: string; name: string; email: string }[];
    memberOf: { householdOwnerId: string; name: string; linkId: string } | null;
  }> {
    const mine = await this.links.find({ where: { householdOwnerId: ownerId } });
    const caregivers = await Promise.all(
      mine.map(async (l) => {
        const o = await this.owners.findOne({ where: { id: l.caregiverOwnerId } });
        return { id: l.id, name: o?.name ?? 'Caregiver', email: o?.email ?? '' };
      }),
    );
    const membership = await this.links.findOne({ where: { caregiverOwnerId: ownerId } });
    // Include the link id, so a caregiver can actually LEAVE the household from the
    // app. The remove() endpoint already permits a caregiver to delete their own link;
    // without the id in this payload the UI had no way to call it - a dead end that
    // stranded a caregiver sharing all their data with the household owner.
    let memberOf: { householdOwnerId: string; name: string; linkId: string } | null = null;
    if (membership) {
      const primary = await this.owners.findOne({ where: { id: membership.householdOwnerId } });
      memberOf = {
        householdOwnerId: membership.householdOwnerId,
        name: primary?.name ?? 'your household',
        linkId: membership.id,
      };
    }
    return { caregivers, memberOf };
  }

  /** Primary removes a caregiver (or a caregiver leaves their own link). */
  async remove(ownerId: string, linkId: string): Promise<{ ok: true }> {
    const link = await this.links.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Link not found.');
    if (link.householdOwnerId !== ownerId && link.caregiverOwnerId !== ownerId) {
      throw new ForbiddenException('Not your household.');
    }
    await this.links.remove(link);
    return { ok: true };
  }
}
