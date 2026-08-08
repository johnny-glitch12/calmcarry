import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { HouseholdService } from '../household/household.service';
import { Device, WarrantyClaim } from '../entities';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(WarrantyClaim)
    private readonly claimRepo: Repository<WarrantyClaim>,
    private readonly household: HouseholdService,
  ) {}

  async listForOwner(ownerId: string): Promise<Device[]> {
    // caregivers see the whole household's devices
    const householdId = await this.household.resolveOwnerId(ownerId);
    return this.deviceRepo.find({
      where: { ownerId: householdId },
      relations: { claims: true },
      order: { createdAt: 'ASC' },
    });
  }

  async registerDevice(
    ownerId: string,
    serial: string,
    details: { purchaseDate?: string; retailer?: string } = {},
  ): Promise<Device> {
    // Bind ownership to the HOUSEHOLD (matching listForOwner/createClaim), not the
    // raw caller - otherwise a caregiver's registration lands under their own id and
    // the unit is invisible/orphaned to the whole household on every read.
    const householdId = await this.household.resolveOwnerId(ownerId);
    // A serial maps to one physical unit. If it's already registered, only the same
    // household may re-register (idempotent); another household is rejected so a user
    // can't hijack a serial they don't possess.
    const normalized = serial.trim().toUpperCase();
    const existing = await this.deviceRepo.findOne({ where: { serial: normalized } });
    if (existing) {
      if (existing.ownerId !== householdId) {
        throw new ConflictException('This serial is already registered to another account.');
      }
      return existing;
    }
    const device = this.deviceRepo.create({
      ownerId: householdId,
      serial: normalized,
      nickname: null,
      model: 'CalmCarry · Glow Orb',
      warrantyStatus: 'active',
      warrantyMonths: 24,
      // Persist what the form collects, instead of dropping it on the floor.
      purchaseDate: details.purchaseDate ?? null,
      retailer: details.retailer?.trim() || null,
    });
    try {
      return await this.deviceRepo.save(device);
    } catch {
      // unique-serial race: another request inserted it first - re-read and honour
      // the idempotent/ownership rules instead of surfacing a 500.
      const raced = await this.deviceRepo.findOne({ where: { serial: normalized } });
      if (raced) {
        if (raced.ownerId !== householdId) {
          throw new ConflictException('This serial is already registered to another account.');
        }
        return raced;
      }
      throw new ConflictException('Could not register this serial. Please try again.');
    }
  }

  async createClaim(
    ownerId: string,
    deviceId: string,
    type: string,
    description: string | null,
  ): Promise<WarrantyClaim> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    // the device must belong to the caller's household (owner or a linked caregiver)
    const householdId = await this.household.resolveOwnerId(ownerId);
    if (device.ownerId !== householdId) {
      throw new ForbiddenException('This device belongs to another household');
    }

    const claim = this.claimRepo.create({
      deviceId,
      type,
      description,
      status: 'submitted',
      reference: this.generateReference(),
    });
    return this.claimRepo.save(claim);
  }

  // e.g. GC-CLM-7F3A9C - crypto-strong so references aren't guessable/enumerable
  private generateReference(): string {
    return `GC-CLM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
