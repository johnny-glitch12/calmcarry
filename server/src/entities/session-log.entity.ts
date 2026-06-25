import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Owner } from './owner.entity';

@Entity('session_logs')
export class SessionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => Owner, (owner) => owner.logs)
  @JoinColumn({ name: 'ownerId' })
  owner: Owner;

  @Column({ type: 'text', nullable: true })
  deviceId: string | null;

  @Column({ type: 'text', nullable: true })
  contentId: string | null;

  // NOTE: deliberately NO mood/settle rating — the plan forbids symptom tracking,
  // clinical scales, and mood history (§3 "never feel like a patient" + §13 data
  // minimization). A session log records only that a session ran, never how the
  // user felt.
  @CreateDateColumn()
  startedAt: Date;
}
