import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A one-time, expiring code a primary owner shares so a caregiver can join their
 * household (build plan "shared caregivers"). Redeemed → a CaregiverLink is created.
 */
@Index('uq_caregiver_invite_code', ['code'], { unique: true })
@Entity('caregiver_invites')
export class CaregiverInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  householdOwnerId: string;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'text', nullable: true })
  redeemedByOwnerId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
