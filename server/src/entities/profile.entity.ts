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

export type ProfileType = 'adult' | 'kids';

/** A member of the household (build plan §9). One Owner/account = one household. */
// At most ONE primary profile per owner — DB-enforced so a lazy create on a
// concurrent GET can't mint two primaries.
@Index('uq_profile_primary', ['ownerId'], { unique: true, where: '"isPrimary" = true' })
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => Owner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Owner;

  @Column()
  name: string;

  @Column({ type: 'text', default: 'adult' })
  type: ProfileType;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'text', nullable: true })
  ageBand: string | null;

  /** anonymous-by-default in community (build plan §6) */
  @Column({ default: true })
  anonymous: boolean;

  /** "who's it for" picks, kept per profile */
  @Column({ type: 'simple-json', nullable: true })
  prefs: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
