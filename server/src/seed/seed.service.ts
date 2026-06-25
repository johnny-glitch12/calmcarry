import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { isProd } from '../config';
import {
  ContentItem,
  Device,
  Entitlement,
  Owner,
  Profile,
  Program,
} from '../entities';

const DEMO_EMAIL = 'sarah@theglowcompany.co';
const DEMO_PASSWORD = 'glow1234';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    @InjectRepository(Entitlement)
    private readonly entitlementRepo: Repository<Entitlement>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(ContentItem)
    private readonly contentRepo: Repository<ContentItem>,
    @InjectRepository(Program)
    private readonly programRepo: Repository<Program>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  /** Seeds only when empty, so it's safe on every boot. */
  async run(): Promise<void> {
    const ownerCount = await this.ownerRepo.count();
    const contentCount = await this.contentRepo.count();

    if (ownerCount > 0 && contentCount > 0) {
      this.logger.log('Database already seeded — skipping.');
      return;
    }
    this.logger.log('Seeding demo data...');

    if (contentCount === 0) {
      await this.seedContent();
      await this.seedPrograms();
    }
    // The demo household ships with KNOWN credentials — dev/demo only. NEVER seed
    // a known-password account into a production database.
    if (ownerCount === 0 && !isProd) {
      await this.seedDemoUser();
    } else if (ownerCount === 0 && isProd) {
      this.logger.warn('Production: skipping demo-user seed (no known-credentials account).');
    }
    // NOTE: the community wins wall is intentionally NOT seeded — it shows only
    // real, user-submitted posts. Fabricated testimonials would be dishonest
    // social proof (and an app-store-review risk for a wellness product).
    this.logger.log('Seed complete.');
  }

  private async seedContent(): Promise<void> {
    // Free sampler = a lean taste; the rest is premium (build plan §6.1).
    const tracks: Partial<ContentItem>[] = [
      { id: 'slow-tide', type: 'soundscape', title: 'Slow Tide', subtitle: 'Ocean swell · low drone', duration: '20 min', audioKey: 'ocean', coverKey: 'slowTide', locked: false },
      { id: 'rainfall', type: 'soundscape', title: 'Rainfall on Canvas', subtitle: 'Steady rain · distant thunder', duration: '45 min', audioKey: 'rain', coverKey: 'rainfall', locked: true },
      { id: 'forest', type: 'soundscape', title: 'Eucalyptus Forest', subtitle: 'Birdsong · soft stream', duration: 'loops', audioKey: 'forest', coverKey: 'forestStream', locked: true },
      { id: 'box-breathing', type: 'breathing', title: 'Box Breathing', subtitle: 'Breathe with the pulse · 4-4-4-4', duration: '8 min', audioKey: 'drone', coverKey: 'boxBreathing', locked: false },
      { id: 'deep-rest', type: 'meditation', title: 'Deep Body Relaxation', subtitle: 'Guided · settle the body', duration: '13 min', audioKey: 'drone', coverKey: 'deepRest', locked: false, newThisMonth: true },
      { id: 'letting-go', type: 'meditation', title: 'Letting Go of Your Day', subtitle: 'Guided · for busy minds', duration: '13 min', audioKey: 'drone', coverKey: 'lettingGo', locked: true, newThisMonth: true },
      { id: 'penguin', type: 'story', title: "A Penguin's Voyage", subtitle: 'Sleep tale · ages 4+', duration: '27 min', audioKey: 'ocean', coverKey: 'penguinVoyage', locked: false },
      { id: 'spa', type: 'soundscape', title: 'Spa Piano', subtitle: 'Playlist · soft keys', duration: '60 min', audioKey: 'piano', coverKey: 'spaMusic', locked: false, newThisMonth: true },
    ];
    await this.contentRepo.save(tracks.map((t) => this.contentRepo.create(t)));
    this.logger.log(`Seeded ${tracks.length} content tracks.`);
  }

  private async seedPrograms(): Promise<void> {
    const programs: Partial<Program>[] = [
      {
        id: 'night-reset',
        title: 'The 3 a.m. Reset',
        subtitle: 'Settle the wake-ups',
        avatar: '3 a.m. parent',
        weeks: 2,
        coverKey: 'slowTide',
        locked: true,
        steps: [
          { day: 1, title: 'Wind down without the clock', trackId: 'deep-rest' },
          { day: 2, title: 'Breathe back to sleep', trackId: 'box-breathing' },
          { day: 3, title: 'Letting go of the day', trackId: 'letting-go' },
          { day: 4, title: 'Drift on the tide', trackId: 'slow-tide' },
        ],
      },
      {
        id: 'after-school',
        title: 'After-school Decompress',
        subtitle: 'Soften the transition home',
        avatar: 'after-school',
        weeks: 1,
        coverKey: 'forestStream',
        locked: true,
        steps: [
          { day: 1, title: 'Forest reset', trackId: 'forest' },
          { day: 2, title: 'Box breathing break', trackId: 'box-breathing' },
          { day: 3, title: 'A penguin to wind down', trackId: 'penguin' },
        ],
      },
      {
        // wellness-not-medical: a ritual, not a supplement taper
        id: 'evening-ritual',
        title: 'Evening Wind-down',
        subtitle: 'A gentler evening rhythm',
        avatar: 'routine-builder',
        weeks: 3,
        coverKey: 'deepRest',
        locked: true,
        steps: [
          { day: 1, title: 'Body scan to settle', trackId: 'deep-rest' },
          { day: 2, title: 'Quiet the busy mind', trackId: 'letting-go' },
          { day: 3, title: 'Drift on slow tide', trackId: 'slow-tide' },
        ],
      },
    ];
    await this.programRepo.save(programs.map((p) => this.programRepo.create(p)));
    this.logger.log(`Seeded ${programs.length} programs.`);
  }

  private async seedDemoUser(): Promise<void> {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const owner = await this.ownerRepo.save(
      this.ownerRepo.create({ email: DEMO_EMAIL, passwordHash, name: 'Sarah Quinn' }),
    );

    await this.entitlementRepo.save(
      this.entitlementRepo.create({
        ownerId: owner.id,
        tier: 'calm_plan',
        status: 'active',
        source: 'apple',
        plan: 'annual',
        productId: 'calmcarry.premium.annual',
        sourceOrderId: 'GC-ORD-DEMO-0001',
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
      }),
    );

    await this.deviceRepo.save(
      this.deviceRepo.create({
        ownerId: owner.id,
        serial: 'GC-2026-08F3-1147',
        nickname: "Sarah's Orb",
        model: 'CalmCarry · Glow Orb',
        warrantyStatus: 'active',
        warrantyMonths: 24,
      }),
    );

    // household: a primary adult + a child profile
    await this.profileRepo.save([
      this.profileRepo.create({ ownerId: owner.id, name: 'Sarah', type: 'adult', isPrimary: true }),
      this.profileRepo.create({ ownerId: owner.id, name: 'Leo', type: 'kids', ageBand: '4-7' }),
    ]);

    this.logger.log(`Seeded demo user ${DEMO_EMAIL} (premium) + household + device.`);
  }
}
