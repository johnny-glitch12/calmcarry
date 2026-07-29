import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One member's report of one post (App Store UGC 1.2).
 *
 * Exists to make reporting IDEMPOTENT PER REPORTER. Before this, /community/report
 * took only a postId - no reporter identity, no dedupe, no route throttle - so a
 * single free account could list the 50 visible posts and report each one four
 * times, permanently rejecting the entire wall. Thresholds only absorb noise if a
 * report means "one distinct member objected".
 */
@Entity('community_reports')
@Index('uq_community_report', ['postId', 'ownerId'], { unique: true })
export class CommunityReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  /** the reporting account (household owner id) */
  @Column({ type: 'text' })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
