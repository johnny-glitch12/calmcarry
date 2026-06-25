import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HouseholdService } from '../household/household.service';
import { Owner, Profile, ProfileType } from '../entities';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly repo: Repository<Profile>,
    @InjectRepository(Owner) private readonly ownerRepo: Repository<Owner>,
    private readonly household: HouseholdService,
  ) {}

  // All profile ops run against the HOUSEHOLD owner, so a caregiver shares the
  // same set of profiles as the primary (one household, whole family).

  async list(ownerId: string): Promise<Profile[]> {
    const householdId = await this.household.resolveOwnerId(ownerId);
    const profiles = await this.repo.find({ where: { ownerId: householdId }, order: { createdAt: 'ASC' } });
    if (profiles.length > 0) return profiles;

    // First access → seed a primary adult profile from the owner's name. The
    // unique index (one primary per owner) makes this race-safe: if a concurrent
    // GET wins, our save throws on the conflict and we just re-read the winner.
    const owner = await this.ownerRepo.findOne({ where: { id: householdId } });
    const primary = this.repo.create({
      ownerId: householdId,
      name: owner?.name?.split(' ')[0] ?? 'Me',
      type: 'adult',
      isPrimary: true,
    });
    try {
      return [await this.repo.save(primary)];
    } catch {
      return this.repo.find({ where: { ownerId: householdId }, order: { createdAt: 'ASC' } });
    }
  }

  async create(ownerId: string, dto: { name: string; type: ProfileType; ageBand?: string | null }): Promise<Profile> {
    const householdId = await this.household.resolveOwnerId(ownerId);
    const profile = this.repo.create({
      ownerId: householdId,
      name: dto.name?.trim() || (dto.type === 'kids' ? 'Little one' : 'Me'),
      type: dto.type ?? 'adult',
      ageBand: dto.ageBand ?? null,
      anonymous: true,
    });
    return this.repo.save(profile);
  }

  async update(ownerId: string, id: string, patch: Partial<Pick<Profile, 'name' | 'ageBand' | 'anonymous' | 'prefs'>>): Promise<Profile> {
    const householdId = await this.household.resolveOwnerId(ownerId);
    const profile = await this.repo.findOne({ where: { id, ownerId: householdId } });
    if (!profile) throw new NotFoundException('Profile not found');
    Object.assign(profile, patch);
    return this.repo.save(profile);
  }

  async remove(ownerId: string, id: string): Promise<{ ok: true }> {
    const householdId = await this.household.resolveOwnerId(ownerId);
    const profile = await this.repo.findOne({ where: { id, ownerId: householdId } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.isPrimary) throw new BadRequestException('Cannot remove the primary profile');
    await this.repo.remove(profile);
    return { ok: true };
  }
}
