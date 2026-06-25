import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityPost } from '../entities';

export interface PublicPost {
  id: string;
  handle: string;
  text: string;
  createdAt: Date;
}

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
  ) {}

  private toPublic(p: CommunityPost): PublicPost {
    return { id: p.id, handle: p.handle, text: p.text, createdAt: p.createdAt };
  }

  async listApproved(): Promise<PublicPost[]> {
    const posts = await this.repo.find({ where: { status: 'approved' }, order: { createdAt: 'DESC' }, take: 50 });
    return posts.map((p) => this.toPublic(p));
  }

  private flagged(text: string): boolean {
    return HOLD_PATTERNS.some((re) => re.test(text));
  }

  async create(ownerId: string, text: string): Promise<PublicPost & { status: string }> {
    const clean = text.trim().slice(0, 400);
    const status = this.flagged(clean) ? 'pending' : 'approved';
    const post = await this.repo.save(
      this.repo.create({ ownerId, handle: 'A CalmCarry parent', text: clean, status }),
    );
    return { ...this.toPublic(post), status: post.status };
  }

  /** real count of approved wins shared by the community (no fabricated number) */
  async presence(): Promise<number> {
    return this.repo.count({ where: { status: 'approved' } });
  }
}
