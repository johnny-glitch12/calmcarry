import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Owner } from './owner.entity';
import { WarrantyClaim } from './warranty-claim.entity';

export type WarrantyStatus = 'active' | 'expired' | 'none';

// A serial identifies ONE physical unit → DB-level uniqueness backstops the
// service's find-first check against a check-then-insert race.
@Index('uq_device_serial', ['serial'], { unique: true })
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => Owner, (owner) => owner.devices)
  @JoinColumn({ name: 'ownerId' })
  owner: Owner;

  @Column()
  serial: string;

  @Column({ type: 'text', nullable: true })
  nickname: string | null;

  @Column({ type: 'text', nullable: true })
  model: string | null;

  @Column({ type: 'text', default: 'active' })
  warrantyStatus: WarrantyStatus;

  @Column({ type: 'int', default: 24 })
  warrantyMonths: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => WarrantyClaim, (claim) => claim.device, { cascade: true })
  claims: WarrantyClaim[];
}
