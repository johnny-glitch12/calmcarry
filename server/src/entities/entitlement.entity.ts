import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Owner } from './owner.entity';
import { TIMESTAMP_TYPE } from './column-types';

export type EntitlementTier = 'free' | 'calm_plan'; // calm_plan = premium
export type EntitlementStatus = 'active' | 'revoked' | 'expired';
export type EntitlementSource = 'apple' | 'google' | 'shopify' | 'comp' | null;
export type EntitlementPlan = 'monthly' | 'annual' | null;

// A receipt/transaction may belong to ONE account only - DB-level backstop to the
// service check (prevents replaying one paid receipt across many accounts).
@Index('uq_entitlement_txn', ['transactionRef'], { unique: true, where: '"transactionRef" IS NOT NULL' })
@Entity('entitlements')
export class Entitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => Owner, (owner) => owner.entitlements)
  @JoinColumn({ name: 'ownerId' })
  owner: Owner;

  @Column({ type: 'text', default: 'free' })
  tier: EntitlementTier;

  @Column({ type: 'text', nullable: true })
  sourceOrderId: string | null;

  @Column({ type: 'text', default: 'active' })
  status: EntitlementStatus;

  // ---- subscription / IAP details (build plan §9) ----
  @Column({ type: 'text', nullable: true })
  source: EntitlementSource;

  @Column({ type: 'text', nullable: true })
  plan: EntitlementPlan;

  @Column({ type: 'text', nullable: true })
  productId: string | null;

  /** Apple originalTransactionId / Google purchaseToken - the renewal key */
  @Column({ type: 'text', nullable: true })
  transactionRef: string | null;

  @Column({ type: TIMESTAMP_TYPE, nullable: true })
  expiresAt: Date | null;

  /**
   * The store's own timestamp for the last lifecycle notification applied here.
   *
   * Store webhooks are at-least-once and arrive out of order: Apple retries an
   * unacknowledged notification, and Google Pub/Sub redelivers by design. Without
   * this, a retried EXPIRED that lost a race with a later DID_RENEW would revoke a
   * subscriber who is paying right now - the entitlement simply took whichever event
   * arrived last.
   */
  @Column({ type: TIMESTAMP_TYPE, nullable: true })
  lastEventAt: Date | null;

  /** Apple notificationUUID / Google messageId of the last applied event, so an exact
   *  redelivery is recognised and does not re-fire churn analytics. */
  @Column({ type: 'text', nullable: true })
  lastEventUid: string | null;

  @CreateDateColumn()
  grantedAt: Date;
}
