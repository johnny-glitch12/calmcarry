import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaregiverLink } from '../entities';

/**
 * Resolves the HOUSEHOLD an account operates within. A primary owner is their own
 * household; a linked caregiver resolves to the primary's id, so entitlement,
 * devices and profiles are all shared across the household (build plan: "one
 * subscription covers everyone… shared caregivers").
 */
@Injectable()
export class HouseholdService {
  constructor(
    @InjectRepository(CaregiverLink) private readonly links: Repository<CaregiverLink>,
  ) {}

  async resolveOwnerId(ownerId: string): Promise<string> {
    const link = await this.links.findOne({ where: { caregiverOwnerId: ownerId } });
    return link ? link.householdOwnerId : ownerId;
  }
}
