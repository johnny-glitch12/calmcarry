import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItem, Program } from '../entities';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ContentItem)
    private readonly contentRepo: Repository<ContentItem>,
    @InjectRepository(Program)
    private readonly programRepo: Repository<Program>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  /** Seeds the real catalogue only when empty, so it's safe on every boot. No demo
   *  owner / household / device is ever seeded - real accounts are created solely by
   *  real sign-up and purchase. The community wall is likewise never seeded (only
   *  real, user-submitted posts), so there is no fabricated social proof. */
  async run(): Promise<void> {
    const contentCount = await this.contentRepo.count();
    if (contentCount > 0) {
      this.logger.log('Catalogue already seeded - skipping.');
      return;
    }
    this.logger.log('Seeding catalogue...');
    await this.seedContent();
    await this.seedPrograms();
    this.logger.log('Seed complete.');
  }

  private async seedContent(): Promise<void> {
    // Free sampler = a lean taste; the rest is premium (build plan §6.1).
    const tracks: Partial<ContentItem>[] = [
      { id: 'slow-tide', type: 'soundscape', title: 'Slow Tide', subtitle: 'Ocean swell · low drone', duration: '20 min', audioKey: 'ocean', coverKey: 'slowTide', locked: false },
      { id: 'rainfall', type: 'soundscape', title: 'Rainfall on Canvas', subtitle: 'Steady rain · distant thunder', duration: '45 min', audioKey: 'rain', coverKey: 'rainfall', locked: true },
      { id: 'forest', type: 'soundscape', title: 'Eucalyptus Forest', subtitle: 'Birdsong · soft stream', duration: 'loops', audioKey: 'forest', coverKey: 'forestStream', locked: true },
      { id: 'box-breathing', type: 'breathing', title: 'Box Breathing', subtitle: 'Breathe with the pulse · 4-4-4-4', duration: '3 min', audioKey: 'guided-box-breathing', coverKey: 'boxBreathing', locked: false },
      { id: 'deep-rest', type: 'meditation', title: 'Deep Body Relaxation', subtitle: 'Guided · settle the body', duration: '4 min', audioKey: 'guided-deep-rest', coverKey: 'deepRest', locked: true, newThisMonth: true },
      { id: 'letting-go', type: 'meditation', title: 'Letting Go of Your Day', subtitle: 'Guided · for busy minds', duration: '4 min', audioKey: 'guided-letting-go', coverKey: 'lettingGo', locked: true, newThisMonth: true },
      { id: 'penguin', type: 'story', title: "A Penguin's Voyage", subtitle: 'Sleep tale · ages 4+', duration: '27 min', audioKey: 'ocean', coverKey: 'penguinVoyage', locked: false },
      { id: 'spa', type: 'soundscape', title: 'Spa Piano', subtitle: 'Playlist · soft keys', duration: '60 min', audioKey: 'piano', coverKey: 'spaMusic', locked: true, newThisMonth: true },
      // The remaining catalogue - mirrors src/content/library.ts so the signed-URL
      // endpoint enforces the SAME free/premium split server-side (no paywall bypass).
      // Free taste = gymnopedie (the one free music track) + brown-noise (the free
      // mixer sound); everything else premium (§6.1).
      { id: 'gymnopedie', type: 'soundscape', title: 'Gymnopédie No. 1', subtitle: 'Erik Satie · solo piano', duration: '3 min', audioKey: 'gymnopedie', coverKey: 'gymnopedie', locked: false, newThisMonth: true },
      { id: 'shoreline', type: 'soundscape', title: 'Shoreline', subtitle: 'Waves washing over rock', duration: 'loops', audioKey: 'waves', coverKey: 'shoreline', locked: true, newThisMonth: true },
      { id: 'fireside', type: 'soundscape', title: 'Fireside', subtitle: 'A slow, crackling campfire', duration: 'loops', audioKey: 'fire', coverKey: 'fireside', locked: true },
      { id: 'dawn-chorus', type: 'soundscape', title: 'Dawn Chorus', subtitle: 'Birdsong · open woodland', duration: 'loops', audioKey: 'birdsong', coverKey: 'dawnWoods', locked: true },
      { id: 'brown-noise', type: 'soundscape', title: 'Brown Noise', subtitle: 'Deep, even masking', duration: 'loops', audioKey: 'brown', coverKey: 'brownNoise', locked: false },
      { id: 'pink-noise', type: 'soundscape', title: 'Pink Noise', subtitle: 'Soft, balanced hush', duration: 'loops', audioKey: 'pink', coverKey: 'pinkNoise', locked: true },
      { id: 'white-noise', type: 'soundscape', title: 'White Noise', subtitle: 'Bright, steady cover', duration: 'loops', audioKey: 'white', coverKey: 'whiteNoise', locked: true },
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
}
