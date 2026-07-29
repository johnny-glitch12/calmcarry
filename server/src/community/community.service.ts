import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityPost, CommunityReport } from '../entities';

export interface SharedMix {
  name: string;
  levels: Record<string, number>;
}

export interface PublicPost {
  id: string;
  handle: string;
  text: string;
  mix: SharedMix | null;
  createdAt: Date;
}

// The only sound keys a shared mix may contain - anything else is dropped on write
// so a client can never smuggle arbitrary JSON into the wall.
const SOUND_KEYS = ['rain', 'ocean', 'brown', 'drone', 'pink', 'white', 'fire', 'birdsong'];

// Gentle auto-moderation: hold posts with contact info / links / clinical terms
// for review; everything else is approved. ownerId is NEVER returned (anonymous).
const HOLD_PATTERNS = [
  /https?:\/\//i,
  /\b\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/, // phone numbers
  /@[\w.]+\.\w+/, // emails / handles
  /\b(anxiety|insomnia|depression|suicid|diagnos|prescri)\w*/i,
];

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityPost) private readonly repo: Repository<CommunityPost>,
    @InjectRepository(CommunityReport) private readonly reports: Repository<CommunityReport>,
  ) {}

  private toPublic(p: CommunityPost): PublicPost {
    return { id: p.id, handle: p.handle, text: p.text, mix: p.mix ?? null, createdAt: p.createdAt };
  }

  /** Whitelist a shared mix: known keys only, levels clamped to 1–3, name capped.
   *  Returns null if there's no real sound in it (so it's treated as a text-only win). */
  private sanitizeMix(raw: unknown): SharedMix | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as { name?: unknown; levels?: unknown };
    const src = r.levels && typeof r.levels === 'object' ? (r.levels as Record<string, unknown>) : {};
    const levels: Record<string, number> = {};
    for (const k of SOUND_KEYS) {
      const v = src[k];
      if (typeof v === 'number' && v > 0) levels[k] = Math.max(1, Math.min(3, Math.round(v)));
    }
    if (Object.keys(levels).length === 0) return null;
    const name = (typeof r.name === 'string' ? r.name : '').trim().slice(0, 60) || 'A shared mix';
    return { name, levels };
  }

  async listApproved(): Promise<PublicPost[]> {
    const posts = await this.repo.find({ where: { status: 'approved' }, order: { createdAt: 'DESC' }, take: 50 });
    return posts.map((p) => this.toPublic(p));
  }

  private flagged(text: string): boolean {
    return HOLD_PATTERNS.some((re) => re.test(text));
  }

  async create(ownerId: string, text: string, rawMix?: unknown): Promise<PublicPost & { status: string }> {
    const clean = text.trim().slice(0, 400);
    const mix = this.sanitizeMix(rawMix);
    // hold for review if the text OR the mix name trips a pattern (name is derived
    // from our own sound labels client-side, but we never trust the client)
    const status = this.flagged(clean) || (mix ? this.flagged(mix.name) : false) ? 'pending' : 'approved';
    const post = await this.repo.save(
      this.repo.create({ ownerId, handle: 'A CalmCarry parent', text: clean, status, mix }),
    );
    return { ...this.toPublic(post), status: post.status };
  }

  /** Member report (App Store UGC 1.2): any member can flag a post. Thresholds
   *  act immediately and quietly: 2 DISTINCT reporters re-hold the post for review
   *  (it leaves the feed), 4 reject it outright.
   *
   *  Reports are recorded PER REPORTER and are idempotent. Previously this took only
   *  a postId - no identity, no dedupe - so one account could report every visible
   *  post four times and permanently empty the wall. reportsCount is now derived
   *  from distinct reporter rows, so a threshold means "N different members
   *  objected", which is the only reading that makes it a moderation signal. */
  async report(postId: string, ownerId: string): Promise<{ ok: true }> {
    const post = await this.repo.findOne({ where: { id: postId } });
    if (!post) return { ok: true }; // nothing to reveal about what exists
    if (post.ownerId && post.ownerId === ownerId) return { ok: true }; // no self-reporting

    try {
      await this.reports.insert({ postId, ownerId });
    } catch {
      // unique (postId, ownerId) violation = this member already reported it.
      // Idempotent by design: return the same quiet 200 without re-counting.
      return { ok: true };
    }

    // Count distinct reporters rather than trusting an incrementing counter.
    const distinct = await this.reports.count({ where: { postId } });
    post.reportsCount = distinct;
    if (distinct >= 4) post.status = 'rejected';
    else if (distinct >= 2) post.status = 'pending';
    await this.repo.save(post);
    return { ok: true };
  }

  /** real count of approved wins shared by the community (no fabricated number) */
  async presence(): Promise<number> {
    return this.repo.count({ where: { status: 'approved' } });
  }
}
