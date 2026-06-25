import { Column, Entity, PrimaryColumn } from 'typeorm';

export type ContentType = 'soundscape' | 'meditation' | 'story' | 'breathing';

@Entity('content_items')
export class ContentItem {
  // id is a human-readable slug, e.g. 'slow-tide'
  @PrimaryColumn()
  id: string;

  @Column({ type: 'text' })
  type: ContentType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  duration: string | null;

  @Column({ type: 'text', nullable: true })
  audioKey: string | null;

  @Column({ type: 'text', nullable: true })
  coverKey: string | null;

  @Column({ type: 'boolean', default: false })
  locked: boolean;

  /** surfaced on Home's "New this month" shelf (CMS-driven) */
  @Column({ type: 'boolean', default: false })
  newThisMonth: boolean;

  @Column({ type: 'text', nullable: true })
  programId: string | null;
}
