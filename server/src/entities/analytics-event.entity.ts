import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * First-party analytics event (build plan §15 funnel: install → sign-in → first
 * session → conversion → retention → churn). Stored anonymously by install id;
 * no PII. A real analytics provider can be fed from here later via a webhook.
 */
@Index('idx_event_name_at', ['name', 'createdAt'])
// Standalone createdAt index for the retention purge (DELETE WHERE createdAt < cutoff);
// the composite above can't serve a bare createdAt range (no leading `name`).
@Index('idx_event_created_at', ['createdAt'])
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  anonId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  props: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
