import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

/** A gentle, anonymous-by-default "wins wall" post (build plan §6/§9). Adults only. */
@Entity('community_posts')
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null for seeded/system posts; never exposed to clients */
  @Column({ type: 'text', nullable: true })
  ownerId: string | null;

  /** what other members see — anonymous by default */
  @Column({ default: 'A CalmCarry parent' })
  handle: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text', default: 'pending' })
  status: ModerationStatus;

  /** member reports (App Store UGC 1.2): thresholds re-hold / remove the post */
  @Column({ type: 'int', default: 0 })
  reportsCount: number;

  /** optional shared sound-machine mix — anonymous (carries no PII). null for an
   *  ordinary text win. Sanitised on write: only known sound keys, levels 1–3. */
  @Column({ type: 'simple-json', nullable: true })
  mix: { name: string; levels: Record<string, number> } | null;

  @CreateDateColumn()
  createdAt: Date;
}
