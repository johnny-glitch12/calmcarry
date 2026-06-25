import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Links a caregiver account to a household (the primary owner). One subscription
 * covers everyone (build plan §6 / v1-v2 "shared caregivers"): a linked caregiver
 * inherits the household's premium, devices and profiles. A caregiver belongs to
 * at most one household (unique caregiverOwnerId).
 */
@Index('uq_caregiver_owner', ['caregiverOwnerId'], { unique: true })
@Entity('caregiver_links')
export class CaregiverLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  householdOwnerId: string;

  @Column()
  caregiverOwnerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
