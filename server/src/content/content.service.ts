import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItem, Program } from '../entities';
import { CdnService } from '../integrations/cdn.service';
import { UsersService } from '../users/users.service';

// Forward-looking check-in intent → recommended content (mirrors the app).
const INTENT_TRACK: Record<string, string> = {
  sleep: 'deep-rest',
  reset: 'box-breathing',
  sounds: 'slow-tide',
  suggest: 'slow-tide',
};

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentItem)
    private readonly contentRepo: Repository<ContentItem>,
    @InjectRepository(Program)
    private readonly programRepo: Repository<Program>,
    private readonly cdn: CdnService,
    private readonly users: UsersService,
  ) {}

  // small in-memory cache: the catalogue is read on nearly every app open but
  // changes rarely (only via CMS publish), so serve it from cache for 60s instead
  // of hitting the DB every request. Invalidated immediately on upsert().
  private catalogCache: { at: number; data: { tracks: ContentItem[]; programs: Program[]; newThisMonth: string[] } } | null = null;
  private static readonly CATALOG_TTL_MS = 60_000;

  async getCatalog(): Promise<{ tracks: ContentItem[]; programs: Program[]; newThisMonth: string[] }> {
    if (this.catalogCache && Date.now() - this.catalogCache.at < ContentService.CATALOG_TTL_MS) {
      return this.catalogCache.data;
    }
    const [tracks, programs] = await Promise.all([this.contentRepo.find(), this.programRepo.find()]);
    const data = { tracks, programs, newThisMonth: tracks.filter((t) => t.newThisMonth).map((t) => t.id) };
    this.catalogCache = { at: Date.now(), data };
    return data;
  }

  /** A short-lived signed URL for the item's audio. Locked items require premium —
   *  enforced server-side so the paywall can't be bypassed by deep-linking. */
  async signedUrl(id: string, ownerId: string): Promise<{ url: string; expiresAt: number | null; signed: boolean }> {
    const item = await this.contentRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Content not found');
    if (item.locked) {
      // expiry-aware: an expired/lapsed subscription must NOT unlock locked audio
      if (!(await this.users.isPremium(ownerId))) throw new ForbiddenException('Premium required');
    }
    // sanitize the CDN object key — never let a CMS audioKey / id traverse paths
    const rawKey = item.audioKey || id;
    if (!/^[A-Za-z0-9_-]+$/.test(rawKey)) throw new NotFoundException('Content not found');
    return this.cdn.signAssetUrl(`audio/${rawKey}.mp3`);
  }

  /** Ephemeral check-in recommendation (build plan §6 — never stored). */
  recommend(intent: string, profileType?: string): { contentId: string } {
    if (profileType === 'kids') return { contentId: 'penguin' };
    return { contentId: INTENT_TRACK[intent] ?? 'slow-tide' };
  }

  /** CMS publish — ship content without an app release (build plan §11). */
  async upsert(item: Partial<ContentItem> & { id: string }): Promise<ContentItem> {
    const saved = await this.contentRepo.save(this.contentRepo.create(item));
    this.catalogCache = null; // publish must be visible immediately
    return saved;
  }
}
